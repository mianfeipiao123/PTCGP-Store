# PTCGP-Store

**Pokémon Trading Card Game Pocket 官方网店地区价格对比网页**

这个网页用来查看 `Pokémon Trading Card Game Pocket` 官方网页商店中不同地区、不同货币的商品价格，并把它们换算成你选择的基准货币，方便快速比较哪里更便宜。

![locales](https://img.shields.io/badge/languages-9-blue)
![currencies](https://img.shields.io/badge/currencies-38-green)
![auto-update](https://img.shields.io/badge/update-hourly-brightgreen)

## 在线访问

如果 GitHub Pages 已启用，可以通过这个地址访问：

https://mianfeipiao123.github.io/PTCGP-Store/

如果页面暂时打不开，请到仓库的 `Settings` → `Pages` 中确认是否已经启用 GitHub Pages，并选择 `main` 分支的 `/root` 目录作为发布来源。

## 这个网页能做什么

- 查看官方网页商店商品在 38 种货币下的原价。
- 把各地区价格换算成同一种基准货币，例如 CNY、USD、JPY、EUR、TWD、HKD、KRW。
- 按换算后价格从低到高或从高到低排序。
- 搜索商品名称或 SKU。
- 切换 9 种界面语言：
  繁體中文 / 日本語 / English / Français / Italiano / Deutsch / Español / Português (Brasil) / 한국어
- 在电脑、平板、手机浏览器中使用。

## 如何使用

1. 打开网页。
2. 在 `Language` 中选择界面语言。
3. 在 `Base currency` 中选择你想用来比较的基准货币。
4. 在 `Sort` 中选择排序方式：
   - `Normalized: cheap → expensive`：按换算后价格从低到高。
   - `Normalized: expensive → cheap`：按换算后价格从高到低。
   - `Currency A → Z`：按货币代码排序。
5. 使用搜索框查找具体商品。

每个商品卡片里会显示：

- 原始货币价格
- 换算后的基准货币价格
- 当前商品中最低价和最高价标记
- 价格比例条，方便快速观察差异

## 数据更新时间

商品和价格数据会通过 GitHub Actions 每 1 小时自动检查一次。

如果官方商店的商品、价格或多语言名称发生变化，仓库中的数据文件会自动更新；如果没有变化，就不会产生新的提交。

网页底部会显示当前数据快照时间。汇率数据来自 `open.er-api.com`，浏览器本地缓存 6 小时，因此换算价格是参考值，不代表实际支付金额。

## 本地打开

如果想在电脑本地查看，可以使用下面方式。

### Windows

双击：

```text
start.bat
```

脚本会启动本地服务器并打开浏览器。

### 手动启动

```bash
node serve.js
```

然后打开：

```text
http://localhost:8080/
```

不要直接双击 `index.html` 打开。浏览器的 `file://` 协议会导致部分数据文件无法正常读取。

## 数据来源说明

商品、价格和多语言商品名来自官方网页商店公开接口：

```text
https://store.pokemontcgpocket.com/
```

本项目只做价格展示和换算，所有商品信息、最终价格、可购买地区和支付规则都以官方网页商店实际显示为准。

## 项目文件

```text
.
├── index.html              网页主体
├── prices.json             商品价格数据
├── product_i18n.json       多语言商品名
├── i18n.json               网页界面文案
├── scrape.js               数据更新脚本
├── serve.js                本地静态服务器
├── start.bat               Windows 本地启动脚本
└── .github/workflows       每小时自动更新任务
```

## 声明

本项目与 The Pokémon Company、Nintendo、Creatures Inc.、GAME FREAK inc.、DeNA Co., Ltd. 没有关联，也不是官方产品。

`Pokémon`、`Pokémon Trading Card Game Pocket` 及相关名称、图像、商标归其各自权利方所有。
