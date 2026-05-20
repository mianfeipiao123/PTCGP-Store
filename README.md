# PTCGP-Store · 各地区价格对比

> **Pokémon Trading Card Game Pocket** 官方网店在不同地区的售价对比工具。
> 一份本地静态网页,9 种语言、38 种货币、12 个商品的全矩阵价格,带实时汇率换算。

![preview](https://img.shields.io/badge/locales-9-blue) ![preview](https://img.shields.io/badge/currencies-38-green) ![preview](https://img.shields.io/badge/no--build-yes-brightgreen)

## 功能

- **9 种 UI 语言** — 完全对齐 [store.pokemontcgpocket.com](https://store.pokemontcgpocket.com/) 官方支持:
  繁體中文 / 日本語 / English / Français / Italiano / Deutsch / Español / Português (Brasil) / 한국어
- **38 种货币原价** — 覆盖全球所有 Xsolla 商户启用的本地化定价
- **基准货币换算** — 默认 CNY,可切 USD / JPY / EUR / GBP / TWD / HKD / KRW 等,实时汇率自动获取(`open.er-api.com`,失败回退 `exchangerate.host`)
- **官方真实商品名** — 通过 `WEB-STORE-LOCALE` HTTP 头从官方 API 抓取的本地化名称(非自创翻译)
- **响应式设计** — 桌面三栏 / 平板两栏 / 手机单栏,适配刘海屏 + 安全区
- **零依赖** — 纯 HTML + 原生 JS,无 npm,无打包

## 快速开始

### Windows

双击 `start.bat`,自动启动本地 server(端口 8080)并打开浏览器。

### 手动启动

```bash
node serve.js
# 浏览器打开 http://localhost:8080/
```

> ⚠️ 不能直接双击 `index.html`(file:// 协议会被浏览器 CORS 拒绝),必须通过 HTTP 访问。

## 文件结构

```
.
├── index.html              主页面(纯静态,所有逻辑)
├── i18n.json               9 种 UI 文案翻译
├── product_i18n.json       9 种语言下 12 个商品的官方真实名
├── prices.json             38 种货币 × 12 个商品的价格矩阵
├── serve.js                零依赖本地 HTTP 服务器
├── start.bat               Windows 一键启动
└── scrape.js               重新抓取价格的脚本
```

## 数据更新

数据保存在 `prices.json` 和 `product_i18n.json`。

GitHub Actions 会每 1 小时自动运行 `scrape.js`,从官方公开 API 刷新商品、价格和多语言名称;如果数据有变化,会自动提交到仓库。

也可以手动刷新:

```bash
node scrape.js
```

约 2 分钟(38 种货币价格请求 + 9 种语言名称请求)。

## 技术细节

### 价格采集

每种货币对应一个代表性国家 IP,通过 `X-Forwarded-For` 头让官方 API 按目标地区返回定价:

```
GET https://store.pokemontcgpocket.com/api/v1/product/list
X-Forwarded-For: 133.32.0.1   # → JPY
X-Forwarded-For: 8.8.8.8      # → USD
```

### 商品名本地化

发现官方 API 接受非标准头 `WEB-STORE-LOCALE: <locale>`,无需登录即可获取本地化商品名:

```
GET https://store.pokemontcgpocket.com/api/v1/product/list
WEB-STORE-LOCALE: zh-TW       # → "慶祝遊戲上線 超值寶可金塊（付費）×5"
WEB-STORE-LOCALE: ja-JP       # → "リリース記念　お得なポケゴールド(有償)×5"
```

### 汇率

`open.er-api.com` 免费 API,本地 `localStorage` 缓存 6 小时,失败自动回退 `exchangerate.host`。

## 法律声明

数据通过对官方公开 API 的合法请求获取,仅用于个人价格对比研究。

`Pokémon`、`Pokémon Trading Card Game Pocket` 及所有相关商标 © 2024 Pokémon / Nintendo / Creatures Inc. / GAME FREAK inc. / DeNA Co., Ltd.

本项目与上述任何公司均无关联,非官方产品。
