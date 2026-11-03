# my-stars

把我的 GitHub Star 按用途分好类，做成一个可以搜索的网站。

**网站地址：** https://axtonsun.github.io/my-stars/

## 能做什么

整个网站是一个老图书馆的卡片目录柜：

- **一个抽屉一个分类**：16 个抽屉，点一个就拉开，右边是里面的卡片；再点一次合上
- **一个仓库一张卡片**：卡片上有索书号（比如「研·02」= AI 科研助手抽屉里 Star 第二多）、中文简介和 Star 数；鼠标移上去会露出标签和作者
- **分隔卡**：拉开抽屉后，按标签筛选（比如只看「论文写作」）；右上角切换按 Star、收藏时间或最近更新排序
- **检索**：仓库名、中英文简介、标签、语言都能搜，按 `/` 直接开始；有结果的抽屉插一面小红旗，写着命中几张
- **卡片详情**：点一张卡片，看完整信息、收藏日期章、还在不在更新，以及主题词相近的其他收藏
- **待归档**：新 Star 的仓库先放进铁丝筐，柜顶会钉一张便条提醒
- 手机上抽屉排成两列，点开整屏进入；网址会记住当前抽屉、筛选和检索词，可以直接收藏或分享

## 怎么保持更新

GitHub Actions 每天北京时间 04:17 自动拉取一次 Star 列表并重新发布网站。在仓库 **Actions** 页面点 **Run workflow** 可以手动触发。

新 Star 的仓库会先进「待归档」的铁丝筐，暂时用 GitHub 自带的简介和 topics，照样能搜到。攒了一些以后，找 Claude 说一句「更新分类」就行（步骤写在 `CLAUDE.md` 里）。

## 文件说明

| 路径 | 作用 |
| --- | --- |
| `site/` | 网站页面（纯 HTML / CSS / JS，无外部依赖）；`draw.js` 画柜子，`app.js` 管交互 |
| `site/fonts/` | 自托管字体：霞鹜文楷（OFL）、Kevin Serif（MIT） |
| `data/stars.json` | 自动同步的 Star 列表，不要手改 |
| `data/classification.json` | 分类、标签和中文简介，可以手改 |
| `scripts/sync_stars.py` | 拉取 Star 列表 |
| `scripts/check_classification.py` | 检查哪些仓库还没分类 |
| `.github/workflows/sync-and-deploy.yml` | 每日同步 + 发布到 GitHub Pages |

## 想手动调整分类？

直接编辑 `data/classification.json`：

- 改某个仓库的分类：改它的 `"cat"`
- 新增分类（= 新抽屉）：在 `categories` 里加一项（`glyph` 是索书号用的一个字），再把它的 id 放进 `groups` 的某一组
- 改中文简介或标签：改 `summary` / `tags`

提交后网站会自动重新发布。

界面设计稿和其他备选方案在 [`design-explorations`](https://github.com/axtonsun/my-stars/tree/design-explorations) 分支。
