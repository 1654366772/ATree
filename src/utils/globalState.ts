import { reactive } from 'vue';

/**
 * 全局状态管理
 * 用于存储跨组件实例、跨路由生命周期的状态
 */
export const globalState = reactive({
  // 正在解析台词的章节 ID 集合
  parsingChapterIds: new Set<number>(),

  /**
   * 检查指定章节是否正在解析
   */
  isChapterParsing(chapterId: number | null): boolean {
    if (chapterId === null) return false;
    return this.parsingChapterIds.has(chapterId);
  },

  /**
   * 添加解析中的章节
   */
  addParsingChapter(chapterId: number) {
    this.parsingChapterIds.add(chapterId);
  },

  /**
   * 移除解析完成或失败的章节
   */
  removeParsingChapter(chapterId: number) {
    this.parsingChapterIds.delete(chapterId);
  },

  // 按章节存储选中的台词 ID 集合
  selectedLineIdsByChapter: new Map<number, Set<number>>(),

  /**
   * 获取指定章节的选中 Set
   */
  getSelectedLineIds(chapterId: number): Set<number> {
    if (!this.selectedLineIdsByChapter.has(chapterId)) {
      this.selectedLineIdsByChapter.set(chapterId, new Set<number>());
    }
    return this.selectedLineIdsByChapter.get(chapterId)!;
  },

  /**
   * 清空选择
   * @param chapterId 如果提供，仅清空该章节；否则清空所有
   */
  clearSelection(chapterId?: number) {
    if (chapterId !== undefined) {
      const set = this.selectedLineIdsByChapter.get(chapterId);
      if (set) set.clear();
    } else {
      this.selectedLineIdsByChapter.clear();
    }
  }
});
