export interface FcpXmlSubtitle {
  text: string;
  durationMs: number; // 时长（毫秒）
}

export interface FcpXmlAudioClip {
  name: string;
  path: string; // 音频文件的绝对或相对路径
  durationMs: number; // 音频总时长（毫秒）
  subtitles: FcpXmlSubtitle[]; // 涵盖此音频的字幕
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
  md5?: string;
  createTime?: number; // unix seconds
  importTime?: number; // unix seconds
}

/**
 * 转义 HTML 字符以确保 XML 插入安全
 */
function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * 按标点符号分割文本，如果片段仍超过最大长度，则按长度分割。
 */
export function splitText(text: string, maxLength: number, splitByPunctuation: boolean): string[] {
  if (!text) return [];

  const clean = (s: string) => s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '').trim();

  // 如果 maxLength <= 0，视为不按字数拆分
  if (maxLength <= 0) {
    if (splitByPunctuation) {
      const regex = /([^,.!?，。！？;；]+[,.!?，。！？;；]*)/g;
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        return matches.map(s => clean(s)).filter(s => s.length > 0);
      }
    }
    return [clean(text)].filter(s => s.length > 0);
  }

  const minLen = Math.min(3, Math.max(1, maxLength));
  const isPunctOnly = (s: string) => /^[\s,.;:!?，。！？;；、…—“”‘’"'：！？【】（）()\[\]{}]+$/.test(s);

  let initialSegments: string[] = [text];

  if (splitByPunctuation) {
    const regex = /([^,.!?，。！？;；]+[,.!?，。！？;；]*)/g;
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      initialSegments = matches.map(s => s.trim()).filter(s => s.length > 0);
    }
  }

  // 先合并只包含标点的片段
  const merged: string[] = [];
  for (let i = 0; i < initialSegments.length; i++) {
    const seg = initialSegments[i];
    if (!seg) continue;
    if (isPunctOnly(seg)) {
      if (merged.length > 0) {
        merged[merged.length - 1] += seg;
      } else if (i + 1 < initialSegments.length) {
        initialSegments[i + 1] = seg + initialSegments[i + 1];
      }
      continue;
    }
    merged.push(seg);
  }

  const splitLong = (segment: string): string[] => {
    if (segment.length <= maxLength) return [segment];
    const parts: string[] = [];
    for (let i = 0; i < segment.length; i += maxLength) {
      parts.push(segment.substring(i, i + maxLength));
    }
    // 末尾过短则并入上一段
    if (parts.length >= 2 && parts[parts.length - 1].length < minLen) {
      parts[parts.length - 2] += parts.pop();
    }
    return parts;
  };

  // 再做长度控制，避免过短片段
  const finalSegments: string[] = [];
  let current = '';
  const pushCurrent = () => {
    if (current) finalSegments.push(current);
    current = '';
  };

  for (const segRaw of merged) {
    const segs = splitLong(segRaw);
    for (const seg of segs) {
      if (!current) {
        current = seg;
        continue;
      }
      if ((current + seg).length <= maxLength) {
        current += seg;
      } else if (current.length < minLen) {
        // 当前太短，允许略超长以避免过短字幕
        current += seg;
        pushCurrent();
      } else {
        pushCurrent();
        current = seg;
      }
    }
  }
  pushCurrent();

  return finalSegments.map(s => clean(s)).filter(s => s.length > 0);
}

/**
 * 生成 FCP 7 XML（Premiere Pro 可读）
 * @param projectName 项目名称 / 序列名称
 * @param clips 带有字幕的音频片段数组
 * @param timebase 帧率 (默认: 30)
 * @returns XML 字符串
 */
export function generateFcpXml(projectName: string, clips: FcpXmlAudioClip[], timebase = 30): string {
  const fps = timebase;
  
  // 将毫秒转换为帧
  const msToFrames = (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.max(1, Math.round((ms / 1000) * fps));
  };

  const audioTotalFrames = clips.reduce((sum, c) => sum + msToFrames(c.durationMs), 0);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${escapeXml(projectName)}</name>
    <duration>TBD</duration>
    <rate>
      <timebase>${timebase}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <width>1920</width>
            <height>1080</height>
            <pixelaspectratio>square</pixelaspectratio>
          </samplecharacteristics>
        </format>
        <track>
        </track>
        <track>
`;

  // --- 字幕 (视频轨道 2) ---
  let videoCurrentFrame = 0;
  for (const clip of clips) {
    const audioFrames = msToFrames(clip.durationMs);
    if (audioFrames <= 0) continue;
    let clipVideoFrames = 0;

    // 计算每个字幕的实际帧数以避免舍入间隙
    // 我们将根据 durationMs 按比例分配帧数
    for (let i = 0; i < clip.subtitles.length; i++) {
      const sub = clip.subtitles[i];
      let subFrames = msToFrames(sub.durationMs);

      // 在最后一个字幕上，吸收任何舍入误差
      if (i === clip.subtitles.length - 1) {
        subFrames = Math.max(0, audioFrames - clipVideoFrames);
      }
      clipVideoFrames += subFrames;

      if (subFrames <= 0) continue;

      const escapedText = escapeXml(sub.text);

      xml += `          <generatoritem id="title-${videoCurrentFrame}">
            <name>Text</name>
            <duration>${subFrames}</duration>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <start>${videoCurrentFrame}</start>
            <end>${videoCurrentFrame + subFrames}</end>
            <in>0</in>
            <out>${subFrames}</out>
            <effect>
              <name>Text</name>
              <effectid>Text</effectid>
              <effectcategory>Text</effectcategory>
              <effecttype>generator</effecttype>
              <mediatype>video</mediatype>
              <parameter>
                <parameterid>str</parameterid>
                <name>Text</name>
                <value>${escapedText}</value>
              </parameter>
              <parameter>
                <parameterid>alignment</parameterid>
                <name>Alignment</name>
                <value>1</value>
              </parameter>
              <parameter>
                <parameterid>origin</parameterid>
                <name>Origin</name>
                <value>0.5 0.5</value>
              </parameter>
              <parameter>
                <parameterid>center</parameterid>
                <name>Center</name>
                <value>
                  <horiz>0</horiz>
                  <vert>0.40</vert>
                </value>
              </parameter>
            </effect>
          </generatoritem>
`;
      videoCurrentFrame += subFrames;
    }
  }

  // 更新总时长
  const totalFrames = Math.max(videoCurrentFrame, audioTotalFrames);
  xml = xml.replace('<duration>TBD</duration>', `<duration>${totalFrames}</duration>`);

  xml += `        </track>
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
`;

  // --- 音频轨道 1 ---
  xml += `        <track>\n`;
  let audioCurrentFrame = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const frames = msToFrames(clip.durationMs);
    if (frames <= 0) continue;
    const audioPathEscaped = escapeXml(clip.path.replace(/\\/g, '/')); // 为跨平台 FCP XML 路径使用前斜杠
    const fileUrl = `file://localhost/${audioPathEscaped.replace(/^\//, '')}`;

    xml += `          <clipitem id="audio-${i}">
            <name>${escapeXml(clip.name)}</name>
            <duration>${frames}</duration>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <start>${audioCurrentFrame}</start>
            <end>${audioCurrentFrame + frames}</end>
            <in>0</in>
            <out>${frames}</out>
            <file id="audio-file-${i}">
              <name>${escapeXml(clip.name)}</name>
              <pathurl>${fileUrl}</pathurl>
              <media>
                <audio>
                  <samplecharacteristics>
                    <depth>16</depth>
                    <samplerate>48000</samplerate>
                  </samplecharacteristics>
                  <channelcount>2</channelcount>
                </audio>
              </media>
            </file>
            <sourcetrack>
              <mediatype>audio</mediatype>
              <trackindex>1</trackindex>
            </sourcetrack>
          </clipitem>
`;
    audioCurrentFrame += frames;
  }
  xml += `        </track>\n`;
  
  // 关闭 XML
  xml += `      </audio>
    </media>
  </sequence>
</xmeml>`;

  return xml;
}
