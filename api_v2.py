import os
import shutil
import tempfile
import torch
import uvicorn
import asyncio
import io
import time
import torchaudio
import argparse
from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile, Form
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from contextlib import asynccontextmanager

from indextts.infer_v2 import IndexTTS2


# --- 命令行参数逻辑 ---
def get_args():
    parser = argparse.ArgumentParser(description="IndexTTS2 API Server")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="监听地址")
    parser.add_argument("--port", type=int, default=8000, help="监听端口")
    
    # 交互式询问或使用默认值
    parser.add_argument("--use_fp16", action="store_true", default=None, help="是否启用 fp16")
    parser.add_argument("--use_deepspeed", action="store_true", default=None, help="是否启用 DeepSpeed")
    parser.add_argument("--use_cuda_kernel", action="store_true", default=None, help="是否启用 CUDA Kernel")
    parser.add_argument("--no_interactive", action="store_true", help="禁用交互式询问，直接使用命令行参数")
    
    return parser.parse_args()

args = get_args()

# 如果没有开启非交互模式，则在控制台询问
def interactive_config():
    # 自动检测 CUDA
    has_cuda = torch.cuda.is_available()
    
    # 检查是否在命令行中指定了任何加速标志
    cli_specified = any(x is not None for x in [args.use_fp16, args.use_deepspeed, args.use_cuda_kernel])
    
    if args.no_interactive or cli_specified:
        # 如果指定了，则没传的默认为 False (或者您可以改为默认为 has_cuda，但既然显式传参了，未传的按常规设为 False 较保险)
        # 这里我们选择：如果传了任何一个，则没传的统统设为 False，避免用户混淆
        return bool(args.use_fp16), bool(args.use_deepspeed), bool(args.use_cuda_kernel)
    
    print("\n--- 模型加载配置询问 ---")
    
    def ask_bool(prompt, default):
        choice = input(f"{prompt} (y/n, 默认 {'y' if default else 'n'}): ").lower().strip()
        if not choice: return default
        if choice == 'y': return True
        if choice == 'n': return False
        return default

    use_fp16 = ask_bool("是否启用 fp16 (半精度加速)", default=has_cuda)
    use_deepspeed = ask_bool("是否启用 DeepSpeed (推理优化)", default=has_cuda)
    use_cuda_kernel = ask_bool("是否启用 custom CUDA Kernel (BigVGAN 加速)", default=has_cuda)
    
    print("------------------------\n")
    return use_fp16, use_deepspeed, use_cuda_kernel

# 执行交互式询问
final_fp16, final_deepspeed, final_cuda_kernel = interactive_config()

# --- 配置与全局变量 ---
UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

tts_model: Optional[IndexTTS2] = None

# --- 显存管理：动态控制并发数量 ---
class VRAMManager:
    def __init__(self, min_vram_mb: int = 2048):
        self.min_vram_mb = min_vram_mb
        self.semaphore = asyncio.Semaphore(1)

    async def wait_for_slot(self):
        """等待直到显存足够进行下一次生成"""
        if not torch.cuda.is_available():
            async with self.semaphore:
                yield
            return

        while True:
            free, total = torch.cuda.mem_get_info()
            free_mb = free / (1024**2)
            if free_mb > self.min_vram_mb:
                break
            await asyncio.sleep(1)
        
        async with self.semaphore:
            yield

vram_manager = VRAMManager()

# --- 生命周期管理 ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global tts_model
    print(f"正在启动服务 (配置: fp16={final_fp16}, deepspeed={final_deepspeed}, cuda_kernel={final_cuda_kernel})...")
    try:
        tts_model = IndexTTS2(
            cfg_path="checkpoints/config.yaml",
            model_dir="checkpoints",
            use_fp16=final_fp16,
            use_deepspeed=final_deepspeed,
            use_cuda_kernel=final_cuda_kernel
        )
        print("模型加载成功！")
    except Exception as e:
        print(f"模型加载失败: {str(e)}")
    yield
    print("正在关闭服务...")
    if tts_model:
        del tts_model
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

app = FastAPI(title="IndexTTS2 API", description="优化的 IndexTTS2 推理接口", lifespan=lifespan)

# --- 模型定义 ---
# 这里的属性严格对应 IndexTTS2.infer(...）接口的接收参数
class TTSRequest(BaseModel):
    spk_audio_prompt: str = Field(..., description="参考音频在 uploads 目录下的文件名或绝对路径")
    text: str = Field(..., description="要合成的文本内容")
    output_path: Optional[str] = Field(None, description="输出音频路径（API内部会自动处理，通常不需要手动指定）")
    emo_audio_prompt: Optional[str] = Field(None, description="情感参考音频")
    emo_alpha: float = Field(1.0, description="情感强度/混合系数")
    emo_vector: Optional[List[float]] = Field(None, description="情感维度向量")
    use_emo_text: bool = Field(False, description="是否使用根据text推断的情感")
    emo_text: Optional[str] = Field(None, description="用于推断情感向量的文本")
    use_random: bool = Field(False, description="是否启用随机情感向量抽取")
    interval_silence: int = Field(200, description="段间的静音时长（毫秒）")
    verbose: bool = Field(False, description="是否输出详细日志")
    max_text_tokens_per_segment: int = Field(120, description="单段合成的最大文本token数量")
    # stream_return: bool = Field(False, description="是否开启流式返回（由接口类型决定，通常不需要手动指定）")
    # more_segment_before : int = Field(0, description="提前生成的段数")
    
    # 以下为 infer 方法中通过 **generation_kwargs 接收的参数
    do_sample: bool = Field(True, description="是否采用采样")
    top_p: float = Field(0.8, description="采样参数 top_p")
    top_k: int = Field(30, description="采样参数 top_k")
    temperature: float = Field(0.8, description="采样参数 temperature")
    length_penalty: float = Field(0.0, description="长度惩罚因子")
    num_beams: int = Field(3, description="波束搜索大小")
    repetition_penalty: float = Field(10.0, description="重复惩罚")
    max_mel_tokens: int = Field(1500, description="最大生成mel token长度")

class BatchTTSRequest(BaseModel):
    requests: List[TTSRequest]


def prepare_infer_params(req: TTSRequest) -> Dict[str, Any]:
    """
    将 TTSRequest 转换为 infer 方法可接收的参数字典
    """
    # 提取所有字段
    params = req.model_dump()
    
    # 将 generation_kwargs 相关的参数提取出来，因为 infer 内部是 **generation_kwargs 接收的
    # 但由于我们的 TTSRequest 是扁平化的，直接传给 infer(..., **params) 也是完全可以的，
    # Python 会自动匹配命名参数，多余的会进入 generation_kwargs。
    return params

# --- 路由接口 ---
@app.get("/check_file_exists", description="检查文件是否存在")
def check_file_exists(path: str) -> bool:
    if not os.path.isabs(path):
        path = os.path.abspath(path)
    return os.path.exists(path)

@app.get("/heartbeat", description="心跳检测接口")
def heartbeat():
    return {"status": "ok", "time": time.time()}

@app.post("/upload_reference", description="上传参考音频文件")
async def upload_reference(
    file: UploadFile = File(...), 
    directory: str = Form(...), 
    fileName: str = Form(None)
):
    """
    上传文件到指定目录并保存为指定文件名（可选）。
    - directory: 文件的保存目录。自动去除首个 '/' 以防变为绝对路径。
    - fileName: 保存的文件名。如果重名，自动添加时间戳后缀。
    """
    # 处理目录，防止误设为根目录
    safe_dir = directory.lstrip("/")
    if not safe_dir:
        safe_dir = "."
    os.makedirs(safe_dir, exist_ok=True)
    
    # 确定文件名基准
    original_name = fileName if fileName else file.filename
    base, ext = os.path.splitext(original_name)
    
    # 检查重名逻辑
    final_path = os.path.join(safe_dir, original_name)
    final_filename = original_name
    
    if os.path.exists(final_path):
        # 存在同名文件，添加时间戳
        timestamp = int(time.time())
        final_filename = f"{base}_{timestamp}{ext}"
        final_path = os.path.join(safe_dir, final_filename)
    
    # 执行保存
    with open(final_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"filename": final_filename, "path": os.path.abspath(final_path)}

@app.post("/infer", description="单次完整音频合成并返回 WAV 文件")
async def infer(request: TTSRequest, background_tasks: BackgroundTasks):
    if tts_model is None: raise HTTPException(status_code=500, detail="模型未加载")
    params = prepare_infer_params(request)
    # params["stream_return"] = False  # 强制同步模式

    tmp_path = ""
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".wav")
        os.close(tmp_fd)
        params["output_path"] = tmp_path
        async for _ in vram_manager.wait_for_slot():
            # 直接解包 params 传给 infer
            tts_model.infer(**params)
        background_tasks.add_task(os.remove, tmp_path)
        return FileResponse(tmp_path, media_type="audio/wav", filename="output.wav")
    except Exception as e:
        if tmp_path and os.path.exists(tmp_path): os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"推理失败: {str(e)}")

@app.post("/infer_stream", description="流式推理接口 (POST方式，发送 TTSRequest)")
async def infer_stream(request: TTSRequest):
    """
    边生成边返回分段 WAV。此方法使用 POST 请求以便传递复杂的 TTS 参数。
    """
    if tts_model is None:
        raise HTTPException(status_code=500, detail="模型未加载")

    params = prepare_infer_params(request)
    params["stream_return"] = True  # 开启流式模式以供 infer 内部逻辑判断 (虽然下面直接调用 infer_generator)
    params.pop("output_path", None) # 流式模式不需要输出路径

    async def generate_chunks():
        # infer_generator 接收的参数和 infer 基本一致
        # 我们这里直接将 params 解包传给它
        gen = tts_model.infer_generator(**params)
        async for _ in vram_manager.wait_for_slot():
            for chunk in gen:
                if chunk is not None:
                    buf = io.BytesIO()
                    torchaudio.save(buf, chunk.type(torch.int16), 22050, format="wav")
                    yield buf.getvalue()
                await asyncio.sleep(0.01)
    return StreamingResponse(generate_chunks(), media_type="audio/wav")

@app.post("/infer_batch", description="批量任务串行生成，逐条返回音频流")
async def infer_batch(request: BatchTTSRequest):
    """
    接收多组请求，按照显存锁排队生成。每生成完毕一组音频即发送到客户端。
    """
    if tts_model is None:
        raise HTTPException(status_code=500, detail="模型未加载")

    async def batch_generator():
        for req in request.requests:
            params = prepare_infer_params(req)
            # params["stream_return"] = False
            tmp_path = ""
            try:
                tmp_fd, tmp_path = tempfile.mkstemp(suffix=".wav")
                os.close(tmp_fd)
                params["output_path"] = tmp_path
                async for _ in vram_manager.wait_for_slot():
                    tts_model.infer(**params)
                with open(tmp_path, "rb") as f: yield f.read()
                if os.path.exists(tmp_path): os.remove(tmp_path)
            except Exception as e:
                print(f"批量任务中某项生成失败: {e}")
                if tmp_path and os.path.exists(tmp_path): os.remove(tmp_path)
                continue
    return StreamingResponse(batch_generator(), media_type="application/octet-stream")

if __name__ == "__main__":
    uvicorn.run(app, host=args.host, port=args.port)
