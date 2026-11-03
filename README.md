# my-stars

中文 · [English](README.en.md)

把我的 GitHub Star 按用途分好类，做成一个可以搜索的网站，中英双语。

**网站地址：** https://axtonsun.github.io/my-stars/

## 能做什么

整个网站是一个老图书馆的卡片目录柜：

- **一个抽屉一个分类**：抽屉按大类分组排列，点一个就拉开，右边是里面的卡片；再点一次合上
- **一个仓库一张卡片**：卡片上有索书号（比如「研·02」= AI 科研助手抽屉里 Star 第二多）、一句话简介和 Star 数；鼠标移上去会露出标签、作者和语言
- **分隔卡**：拉开抽屉后，按标签筛选（比如只看「论文写作」），抽屉里至少两张卡片共用的标签都有一张分隔卡；右上角切换按 Star、收藏时间或最近更新排序
- **检索**：仓库名、中英文简介、标签、编程语言都能搜，按 `/` 直接开始；有结果的抽屉插一面小红旗，写着命中几张
- **卡片详情**：点一张卡片，看完整信息、收藏日期章、还在不在更新，以及主题词相近的其他收藏；按 `Esc` 放回去
- **待归档**：新 Star 的仓库先放进铁丝筐，柜顶会钉一张便条提醒
- **中英双语**：右上角「中文 / EN」切换。第一次打开时跟着浏览器的语言走，之后记住你选的那个。分类名、简介和标签都有两种语言，不管看哪种，中英文都能搜到
- 手机上抽屉排成两列，点开整屏进入；网址会记住当前抽屉、筛选、检索词和语言，可以直接收藏或分享

## 怎么保持更新

GitHub Actions 每天北京时间 04:17 自动拉取一次 Star 列表并重新发布网站，往 `main` 推送也会重新发布。在仓库 **Actions** 页面点 **Run workflow** 可以手动触发。

新 Star 的仓库会先进「待归档」的铁丝筐，暂时用 GitHub 自带的简介和 topics，照样能搜到。攒了一些以后，找 Claude 说一句「更新分类」就行：它会写好中英文简介和标签，把卡片归进抽屉（步骤写在 `CLAUDE.md` 里）。

## 文件说明

| 路径 | 作用 |
| --- | --- |
| `site/` | 网站页面：纯 HTML / CSS / JS，不用构建，也不引用任何外部资源，国内打开也快 |
| `site/draw.js` | 用 SVG 画手绘风格的柜子 |
| `site/app.js` | 交互和状态（记在网址里） |
| `site/i18n.js` | 界面上的中英文文字 |
| `site/fonts/` | 自托管字体：霞鹜文楷（OFL）、Kevin Serif（MIT） |
| `data/stars.json` | 自动同步的 Star 列表，不要手改 |
| `data/classification.json` | 分类、标签和中英文简介，可以手改 |
| `scripts/sync_stars.py` | 拉取 Star 列表 |
| `scripts/check_classification.py` | 检查分类：没分类的、已取消 Star 的、缺英文的、用不上的标签 |
| `.github/workflows/sync-and-deploy.yml` | 每日同步 + 发布到 GitHub Pages |

## 想手动调整分类？

直接编辑 `data/classification.json`：

- 改某个仓库的分类：改它的 `"cat"`
- 改简介：中文写在 `summary`，英文写在 `summary_en`
- 改标签：改 `tags`。标签只写一次，中文标签要在 `tags_en` 里配一个英文名，英文界面显示的就是它。标签只写内容，不写仓库用什么语言写的：卡片上已经显示 GitHub 的语言，也能搜到
- 新增分类（= 新抽屉）：在 `categories` 里加一项，写好 `name` / `desc` 和英文的 `name_en` / `desc_en`（`glyph` 是索书号用的一个字，英文界面也用它），再把它的 id 放进 `groups` 的某一组。`name_en` 要短：抽屉标签上只放得下两行，每行十五个字母左右

改完先跑一下检查脚本，没有报错再提交：

```bash
python3 scripts/check_classification.py
```

提交到 `main` 后网站会自动重新发布。

## 本地预览

把 `site/` 和 `data/*.json` 复制到同一个文件夹（`data/` 放在 `index.html` 旁边）：

```bash
mkdir -p /tmp/my-stars-preview/data && cp -r site/. /tmp/my-stars-preview/ && cp data/*.json /tmp/my-stars-preview/data/
```

再在那个文件夹里起一个本地服务器，打开 http://localhost:8000 ：

```bash
cd /tmp/my-stars-preview && python3 -m http.server
```
