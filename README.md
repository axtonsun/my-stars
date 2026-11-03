# my-stars

把我的 GitHub Star 按用途分好类，做成一个可以搜索的网站。

**网站地址：** https://axtonsun.github.io/my-stars/

## 能做什么

- **按分类浏览**：16 个分类、5 个大组（AI 与 Agent、科研、学习资料、研究方向、生活 & 工具）
- **一个框搜全部**：同时搜仓库名、英文原简介、中文简介、标签。按 `/` 直接开始搜
- **标签和语言筛选**：点卡片上的标签，就能看所有带这个标签的仓库
- **四种排序**：最近收藏 / Star 最多 / 最近更新 / 名称
- **提醒**：标出已归档、两年以上没更新的仓库
- 适配手机和深色模式；链接会记住当前分类和搜索词，可以直接收藏或分享

## 怎么保持更新

GitHub Actions 每天北京时间 04:17 自动拉取一次 Star 列表并重新发布网站。在仓库 **Actions** 页面点 **Run workflow** 可以手动触发。

新 Star 的仓库会先进「🆕 新收藏 · 待分类」，暂时用 GitHub topics 当标签，照样能搜到。攒了一些以后，找 Claude 说一句「更新分类」就行（步骤写在 `CLAUDE.md` 里）。

## 文件说明

| 路径 | 作用 |
| --- | --- |
| `site/` | 网站页面（纯 HTML / CSS / JS，无外部依赖） |
| `data/stars.json` | 自动同步的 Star 列表，不要手改 |
| `data/classification.json` | 分类、标签和中文简介，可以手改 |
| `scripts/sync_stars.py` | 拉取 Star 列表 |
| `scripts/check_classification.py` | 检查哪些仓库还没分类 |
| `.github/workflows/sync-and-deploy.yml` | 每日同步 + 发布到 GitHub Pages |

## 想手动调整分类？

直接编辑 `data/classification.json`：

- 改某个仓库的分类：改它的 `"cat"`
- 新增分类：在 `categories` 里加一项，再把它的 id 放进 `groups` 的某一组
- 改中文简介或标签：改 `summary` / `tags`

提交后网站会自动重新发布。
