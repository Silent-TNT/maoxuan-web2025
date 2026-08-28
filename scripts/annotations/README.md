# 注释语义定位

该工具只在本地或构建前调用硅基流动 API。网站浏览器只读取已经通过原文校验的静态 JSON，不会接触 API Key。

```powershell
# 查看待处理规模，不调用 API
npm run annotations:generate -- --dry-run

# 先试跑一篇文章
npm run annotations:generate -- --article="第一卷/006-星星之火，可以燎原" --force

# 断点续跑全部文章；已有结果会自动跳过
npm run annotations:generate

# 强制重做全部文章
npm run annotations:generate -- --force

# 验证所有已采用选择器确实存在于 Markdown 原文
npm run annotations:check

# 将不确定结果导出为可勾选的 Markdown 复核清单
npm run annotations:review-report

# 清除旧结果中误识别为注释的（1）（2）等正文枚举
npm run annotations:sanitize
```

通过置信度和原文校验的结果写入 `.vitepress/data/note-selectors.generated.json`；不确定、缺失或接口失败的结果写入 `.vitepress/data/note-selectors.review.json`。

长文章默认按 8 个角标分批请求，并为每批设置 60 秒超时。可通过 `ANNOTATION_BATCH_SIZE` 和 `ANNOTATION_TIMEOUT_MS` 调整。
默认同时处理 2 篇文章，可通过 `ANNOTATION_CONCURRENCY` 调整；不建议在未知账户限流时设置过高。

人工写在 `MarginNotes.vue` 中的校准结果优先级更高，不会被生成数据覆盖。
