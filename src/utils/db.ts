import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Windows小说AI配音工具数据库模式定义
 * 按照功能模块分为：文章&章节模块、配音核心模块、资源管理模块
 */
// 一、文章&章节模块（对应「文章管理」UI）
// 1. 文章表（article）- 文章唯一ID（UI卡片序号）
export interface Article {
  id?: number; // 文章唯一ID，自增主键
  name: string; // 文章名称（新增/编辑弹窗）
  create_time: Date; // 创建时间（UI卡片展示）
  is_deleted: number; // 逻辑删除（0=正常，1=删除）
  // 文章设置字段
  inference_model_id?: number; // 关联推理模型配置ID
  inference_model_string?: string; // 推理具体使用的模型ID（从 model_ids 中选择）
  dubbing_model_id?: number; // 关联配音模型配置ID
  dubbing_model_string?: string; // 配音具体使用的模型ID
  prompt_id?: number; // 关联提示词ID
  save_path?: string; // 文章文件保存路径
}

// 2. 章节表（chapter）- 章节唯一ID（侧边栏序号）
export interface Chapter {
  id?: number; // 章节唯一ID，自增主键
  article_id: number; // 关联文章ID（归属文章）
  name: string; // 章节名称（新建章节弹窗）
  content: string; // 章节内容（文本域输入）
  sort_order: number; // 排序（侧边栏显示顺序）
  is_deleted: number; // 逻辑删除
}

// 3. 角色表（role）- 角色唯一ID（角色库序号）
export interface Role {
  id?: number; // 角色唯一ID，自增主键
  article_id: number; // 关联文章ID（归属文章）
  name: string; // 角色名称（新增角色弹窗）
  intro: string; // 角色简介（角色卡片展示）
  dubber_id?: number; // 绑定配音员ID（关联配音员）
  remote_path?: string; // 远程配音样本路径
  is_deleted: number; // 逻辑删除
}

// 4. 台词表（line）- 台词唯一ID（台词列表序号）
export interface Line {
  id?: number; // 台词唯一ID，自增主键
  chapter_id: number; // 关联章节ID（归属章节）
  role_id?: number; // 关联角色ID（角色选择）
  text: string; // 要合成的文本内容
  spk_audio_prompt?: string; // 参考音频路径
  output_path?: string; // 输出音频路径
  emo_audio_prompt?: string; // 情绪参考音频
  gen_audio?: string; // 已生成的音频试听路径
  emo_alpha?: number; // 情绪强度/混合系数
  use_emo_text?: boolean; // 是否使用根据text推断的情绪
  emo_text?: string; // 用于推断情绪向量的文本
  use_random?: boolean; // 是否启用随机情绪向量抽取
  interval_silence?: number; // 段间的静音时长（毫秒）
  verbose?: boolean; // 是否输出详细日志
  max_text_tokens_per_segment?: number; // 单段合成的最大文本token数量
  quick_streaming_tokens?: number; // 快速流式返回的token数量
  stream_return?: boolean; // 是否开启流式返回
  emo_control?: string; // 情绪控制方式控制显示状态缓存
  more_segment_before?: number; // 提前生成的段数
  do_sample?: boolean; // 是否采用采样
  top_p?: number; // 采样参数 top_p
  top_k?: number; // 采样参数 top_k
  temperature?: number; // 采样参数 temperature
  length_penalty?: number; // 长度惩罚因子
  num_beams?: number; // 波束搜索大小
  repetition_penalty?: number; // 重复惩罚
  max_mel_tokens?: number; // 最大生成mel token长度
  happy?: number; // 喜 (0.00 - 1.00)
  angry?: number; // 怒
  sad?: number; // 哀
  afraid?: number; // 惧
  disgusted?: number; // 厌恶
  melancholic?: number; // 低落
  surprised?: number; // 惊喜
  calm?: number; // 平静
  status: number; // 状态：0未生成，1等待中，2生成中，3已完成，4生成失败
  audio_path?: string; // 音频路径（试听按钮关联）
  local_emo_audio?: string; // 本地情绪参考音频路径
  error_msg?: string; // 记录生成失败的错误信息
  is_deleted: number; // 逻辑删除
  sort_order: number; // 排序权重
}

// 5. 配音任务队列表（dub_task）- 任务唯一ID（队列序号）
export interface DubTask {
  id?: number; // 任务唯一ID，自增主键
  line_id: number; // 关联台词ID（对应台词）
  model_id?: number; // 关联AI模型ID（使用模型）
  prompt_id?: number; // 关联提示词ID（使用提示词）
  progress: number; // 任务进度（0-100）
  status: number; // 任务状态（0=未生成, 1=等待中, 2=生成中, 3=已完成, 4=生成失败）
  is_deleted: number; // 逻辑删除
}

// 6. 导出配置表（export_config）- 配置唯一ID
export interface ExportConfig {
  id?: number; // 配置唯一ID，自增主键
  article_id: number; // 关联文章ID（对应文章）
  is_merge_audio: number; // 是否合并音频（0=否，1=是）
  is_merge_sub: number; // 是否合并字幕（0=否，1=是）
  is_check_sub: number; // 是否校对字幕（0=否，1=是）
  file_format: string; // 导出格式（MP3/SRT等）
  save_path: string; // 保存路径（选择路径项）
}

// 7. 配音员表（dubber）- 配音员唯一ID（卡片序号）
export interface VoiceActor {
  id?: number; // 配音员唯一ID，自增主键
  name: string; // 配音员名称（新增弹窗）
  tags: string; // 配音标签（多选，逗号分隔）
  audio_path?: string; // 示例音频路径（播放按钮）
  is_deleted: number; // 逻辑删除
}

// 8. 提示词表（prompt）- 提示词唯一ID（卡片序号）
export interface Prompt {
  id?: number; // 提示词唯一ID，自增主键
  name: string; // 提示词名称（新增弹窗）
  content: string; // 提示词内容（文本域输入）
  params?: string; // 模型参数（可选，JSON字符串）
  is_deleted: number; // 逻辑删除
}

// 9. AI模型表（ai_model）- 模型唯一ID（卡片序号）
export interface AiModel {
  id?: number; // 模型唯一ID，自增主键
  name: string; // 模型名称（新增弹窗）
  type: string; // 模型类型：推理/配音
  base_url?: string; // 模型基础URL（输入项）
  api_key?: string; // API密钥（输入项）
  model_ids: string; // 模型ID列表（逗号分隔）
  is_deleted: number; // 逻辑删除
}

// 10. 标签表 (tag)
export interface Tag {
  id?: number; // 标签唯一ID，自增主键
  type: string; // 标签类型
  value: string; // 标签内容
  is_deleted: number; // 逻辑删除（0=正常，1=删除）
}

export interface AtreeDB extends DBSchema {
  // 一、文章&章节模块（对应「文章管理」UI）
  // 1. 文章表（article）- 文章唯一ID（UI卡片序号）
  article: {
    key: number;
    value: Article;
    indexes: { 'by-create_time': Date; 'by-name': string }; // 按创建时间索引，用于排序；按名称索引，用于判重
  };
  // 2. 章节表（chapter）- 章节唯一ID（侧边栏序号）
  chapter: {
    key: number;
    value: Chapter;
    indexes: {
      'by-article_id': number; // 按文章ID索引，用于查询某文章的所有章节
      'by-sort_order': number; // 按排序索引，用于章节排序显示
    };
  };

  // 二、配音核心模块（对应「配音页面」UI）
  // 3. 角色表（role）- 角色唯一ID（角色库序号）
  role: {
    key: number;
    value: Role;
    indexes: {
      'by-article_id': number; // 按文章ID索引，用于查询某文章的所有角色
      'by-dubber': number; // 按配音员ID索引，用于查询某配音员的所有角色
    };
  };
  // 4. 台词表（line）- 台词唯一ID（台词列表序号）
  line: {
    key: number;
    value: Line;
    indexes: {
      'by-chapter_id': number; // 按章节ID索引，用于查询某章节的所有台词
      'by-role_id': number; // 按角色ID索引，用于查询某角色的所有台词
      'by-sort_order': number; // 按权重排序
    };
  };
  // 5. 配音任务队列表（dub_task）- 任务唯一ID（队列序号）
  dub_task: {
    key: number;
    value: DubTask;
    indexes: {
      'by-line_id': number; // 按台词ID索引，用于查询某台词的所有任务
      'by-status': number; // 按状态索引，用于查询不同状态的任务
    };
  };
  // 6. 导出配置表（export_config）- 配置唯一ID
  export_config: {
    key: number;
    value: ExportConfig;
    indexes: { 'by-article_id': number }; // 按文章ID索引，用于查询某文章的导出配置
  };

  // 三、资源管理模块（对应「配音员/提示词/AI模型」UI）
  // 7. 配音员表（dubber）- 配音员唯一ID（卡片序号）
  dubber: {
    key: number;
    value: VoiceActor;
    indexes: { 'by-name': string };
  };
  // 8. 提示词表（prompt）- 提示词唯一ID（卡片序号）
  prompt: {
    key: number;
    value: Prompt;
    indexes: { 'by-name': string };
  };
  // 9. AI模型表（ai_model）- 模型唯一ID（卡片序号）
  ai_model: {
    key: number;
    value: {
      id?: number; // 模型唯一ID，自增主键
      name: string; // 模型名称（新增弹窗）
      type: string; // 模型类型：推理/配音
      base_url?: string; // 模型基础URL（输入项）
      api_key?: string; // API密钥（输入项）
      model_ids: string; // 模型ID列表（逗号分隔）
      is_deleted: number; // 逻辑删除
    };
    indexes: { 'by-name': string };
  };
  // 10. 标签表 (tag)
  tag: {
    key: number;
    value: {
      id?: number; // 标签唯一ID，自增主键
      type: string; // 标签类型
      value: string; // 标签内容
      is_deleted: number; // 逻辑删除（0=正常，1=删除）
    };
    indexes: { 'by-type': string };
  };
}

/** 默认提示词内容：台词 */
const DEFAULT_PROMPT_CONTENT = `你的任务是将给定小说内容划分为角色和内容，并输出为结构化JSON结果。
台词识别规则：
1. 必须完整保留原文内容，不得遗漏、删改或省略任何字句。
2. 提取角色对话内容喝旁白。识别所有内容，包括带引号（“”）、破折号（——）、感叹号（！）、冒号（：）等常见台词标记的文本，其余均为旁白内容。
3. 若角色在已知角色列表中，则直接使用该角色名；若不在列表中，则根据上下文合理判断角色身份。
4. 相邻台词如属同一角色，可合并为一条，但单条台词长度不得超过150字。
5. 若单条台词超过150字，需按语义完整性拆分为多条，每条不超过150字，并确保原文内容不缺失。

旁白识别规则：
1. 所有非台词的叙述性内容（包括心理活动、环境描写、动作描写、场景过渡等）均标记为“旁白”。
2. 必须保留原文的所有文字内容，不得遗漏、删改或省略任何字句。
3. 相邻的旁白内容可合并为一条，但单条长度不得超过150字。
4. 若单条旁白超过150字，需按语义完整性拆分为多条，每条不超过150字，确保原文内容完整呈现。

情绪推理规则：
1. 根据上下文语境、语气及场景变化，为每条台词推理当前角色的台词情绪（15个字以内）
2. 情绪识别不得影响或改写原文内容，仅用于标注。

特殊情况处理：
1. 多角色连续对话时，确保每条台词对应正确角色，避免角色错配。
2. 当段落中混合出现旁白与台词时，应拆分为独立记录：旁白一条、台词一条。
3. 输出结果不得出现遗漏、重复、合并错误或原文缺失的情况。
4. 拆分、合并及情绪标注仅为结构化目的，须保证原文内容100%完整保留。

输出格式:
严格输出为 json数组。

示例：
小说原文：
一名靠前的灰衣少年似乎与石台上的少年颇为熟悉，他听得大伙的窃窃私语，不由得得意一笑，压低声音道：“牧哥可是被选拔出来参加过“灵路”的人，我们整个北灵境中，可就牧哥一人有名额，你们应该也知道参加“灵路”的都是些什么变态吧？当年我们这北灵境可是因为此事沸腾了好一阵的，从那里出来的人，最后基本全部都是被“五大院”给预定了的。” 
输出：
[
  {"role": "旁白", "text": "一名靠前的灰衣少年似乎与石台上的少年颇为熟悉，他听得大伙的窃窃私语，不由得得意一笑，压低声音道", "emo_text": "绘声绘色，引入入胜的"},
  {"role": "灰衣少年", "text": "牧哥可是被选拔出来参加过“灵路”的人，我们整个北灵境中，可就牧哥一人有名额，你们应该也知道参加“灵路”的都是些通变态吧？当年我们这北灵境可是因为此事沸腾了好一阵的，从那里出来的人，最后基本全部都是被“五大院”给预定了的。", "emo_text": "与有荣焉的，好像这些都是自己"}
]`;

/** 默认提示词参数：台词 */
const DEFAULT_PROMPT_PARAMS = JSON.stringify(
  {
    stream: false,
    tool_choice: 'none',
    response_format: {
      type: 'json_object',
    },
  },
  null,
  2,
);

const DB_NAME = 'atree_db';
const DB_VERSION = 18;

let dbInstance: IDBPDatabase<AtreeDB> | null = null;

/**
 * 初始化数据库并创建对象存储（如果不存在）
 * 按照模块分类创建所有表结构
 */
export async function initDB(): Promise<IDBPDatabase<AtreeDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<AtreeDB>(DB_NAME, DB_VERSION, {
    // eslint-disable-next-line no-shadow
    upgrade(db, oldVersion, newVersion, transaction) {
      // 一、文章&章节模块
      // 1. 创建文章表
      if (!db.objectStoreNames.contains('article')) {
        const articleStore = db.createObjectStore('article', {
          keyPath: 'id',
          autoIncrement: true,
        });
        articleStore.createIndex('by-create_time', 'create_time'); // 按创建时间索引，用于文章列表排序
        articleStore.createIndex('by-name', 'name'); // 名称索引（非唯一，支持重用已删除名称）
      } else {
        // 如果表已存在，检查并创建索引
        const articleStore = transaction.objectStore('article');
        if (!articleStore.indexNames.contains('by-name')) {
          articleStore.createIndex('by-name', 'name');
        }
      }
      // 2. 创建章节表
      if (!db.objectStoreNames.contains('chapter')) {
        const chapterStore = db.createObjectStore('chapter', {
          keyPath: 'id',
          autoIncrement: true,
        });
        chapterStore.createIndex('by-article_id', 'article_id'); // 按文章ID索引，查询某文章的所有章节
        chapterStore.createIndex('by-sort_order', 'sort_order'); // 按排序索引，章节排序显示
      }

      // 二、配音核心模块
      // 3. 创建角色表
      if (!db.objectStoreNames.contains('role')) {
        const roleStore = db.createObjectStore('role', {
          keyPath: 'id',
          autoIncrement: true,
        });
        roleStore.createIndex('by-article_id', 'article_id'); // 按文章ID索引，查询某文章的所有角色
        roleStore.createIndex('by-dubber', 'dubber_id'); // 按配音员ID索引，查询某配音员的所有角色
      }
      // 4. 创建台词表
      if (!db.objectStoreNames.contains('line')) {
        const lineStore = db.createObjectStore('line', {
          keyPath: 'id',
          autoIncrement: true,
        });
        lineStore.createIndex('by-chapter_id', 'chapter_id'); // 按章节ID索引，查询某章节的所有台词
        lineStore.createIndex('by-role_id', 'role_id'); // 按角色ID索引，查询某角色的所有台词
        lineStore.createIndex('by-sort_order', 'sort_order'); // 按权重排序
      } else {
        const lineStore = transaction.objectStore('line');
        if (!lineStore.indexNames.contains('by-sort_order')) {
          lineStore.createIndex('by-sort_order', 'sort_order');
        }
      }
      // 5. 创建配音任务队列表
      if (!db.objectStoreNames.contains('dub_task')) {
        const dubTaskStore = db.createObjectStore('dub_task', {
          keyPath: 'id',
          autoIncrement: true,
        });
        dubTaskStore.createIndex('by-line_id', 'line_id'); // 按台词ID索引，查询某台词的所有任务
        dubTaskStore.createIndex('by-status', 'status'); // 按状态索引，查询不同状态的任务
      }
      // 6. 创建导出配置表
      if (!db.objectStoreNames.contains('export_config')) {
        const exportConfigStore = db.createObjectStore('export_config', {
          keyPath: 'id',
          autoIncrement: true,
        });
        exportConfigStore.createIndex('by-article_id', 'article_id'); // 按文章ID索引，查询某文章的导出配置
      }

      // 三、资源管理模块
      // 7. 创建配音员表
      if (!db.objectStoreNames.contains('dubber')) {
        const dubberStore = db.createObjectStore('dubber', {
          keyPath: 'id',
          autoIncrement: true,
        });
        dubberStore.createIndex('by-name', 'name');
      } else {
        const dubberStore = transaction.objectStore('dubber');
        if (!dubberStore.indexNames.contains('by-name')) {
          dubberStore.createIndex('by-name', 'name');
        }
      }
      // 8. 创建提示词表
      if (!db.objectStoreNames.contains('prompt')) {
        const promptStore = db.createObjectStore('prompt', {
          keyPath: 'id',
          autoIncrement: true,
        });
        promptStore.createIndex('by-name', 'name');
      } else {
        const promptStore = transaction.objectStore('prompt');
        if (!promptStore.indexNames.contains('by-name')) {
          promptStore.createIndex('by-name', 'name');
        }
      }
      // 9. 创建AI模型表
      if (!db.objectStoreNames.contains('ai_model')) {
        const modelStore = db.createObjectStore('ai_model', {
          keyPath: 'id',
          autoIncrement: true,
        });
        modelStore.createIndex('by-name', 'name');
      } else {
        const modelStore = transaction.objectStore('ai_model');
        if (!modelStore.indexNames.contains('by-name')) {
          modelStore.createIndex('by-name', 'name');
        }
      }
      // 10. 创建标签表
      if (!db.objectStoreNames.contains('tag')) {
        const tagStore = db.createObjectStore('tag', {
          keyPath: 'id',
          autoIncrement: true,
        });
        tagStore.createIndex('by-type', 'type');

        // 插入初始数据
        const initialTags = [
          '男声',
          '女声',
          '童声',
          '情绪',
          '叙事',
          '青年',
          '老年',
          '磁性',
          '甜美',
          '旁白',
          '客服',
          '知性',
          '新闻',
          '阳光',
          '广告',
          '萝莉',
          '动漫',
        ];
        initialTags.forEach((value) => {
          tagStore.add({
            type: 'voice',
            value,
            is_deleted: 0,
          });
        });
      }

      // V10 迁移：移除名称索引的唯一性限制
      if (oldVersion < 10 && oldVersion > 0) {
        const stores = ['article', 'dubber', 'prompt', 'ai_model'] as const;
        stores.forEach((storeName) => {
          if (db.objectStoreNames.contains(storeName)) {
            const store = transaction.objectStore(storeName);
            if (store.indexNames.contains('by-name')) {
              store.deleteIndex('by-name');
            }
            store.createIndex('by-name', 'name');
          }
        });
      }
      
      
      // V18 迁移：注入默认“台词”提示词数据
      if (oldVersion < 18) {
        const promptStore = transaction.objectStore('prompt');
        // 由于 getAllByIndex 是异步的，在 upgrade 中直接 add，后续逻辑会自动处理冲突（如有）
        promptStore.add({
          name: '台词',
          content: DEFAULT_PROMPT_CONTENT,
          params: DEFAULT_PROMPT_PARAMS,
          is_deleted: 0,
        });
      }
    },
  });

  return dbInstance;
}

/**
 * 获取数据库实例
 * @returns 返回数据库实例的Promise
 */
export async function getDB(): Promise<IDBPDatabase<AtreeDB>> {
  // eslint-disable-next-line no-return-await
  return await initDB();
}
