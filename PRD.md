# 《灵感显影 Glimpse》MVP PRD

**版本：** V0.1  
**交付时间：** 2026-10-01  
**产品形态：** Mobile-first Web App  
**项目性质：** 小红书 AI 产品岗位笔试 Demo  
**技术原则：** Pure Frontend First  
**核心体验：** Reality → Perception → Reveal

---

## 1. 产品定义

### 1.1 产品名称

**中文：灵感显影**

英文暂定：

**Glimpse**

Slogan：

> **把你一瞬间“看错”的东西，描出来。**

首页辅助文案：

> 有些东西本来不是它。  
> 但那一瞬间，你确实看见了它。

### 1.2 一句话产品定义

灵感显影是一款面向视觉灵感记录场景的 AI 工具。

当用户因为距离、光影、褶皱、纹理、遮挡、透视等因素，把现实中的物体短暂联想成另一个形象时，可以拍摄或上传照片、指出产生联想的位置，并告诉 AI：

> “我刚才把它看成了什么。”

AI 不重新生成一张独立图片，而是在原始照片结构上进行**轮廓显影**，将用户脑中看到的形象描绘出来。

---

## 2. 产品要解决的问题

传统相机解决：

> 我刚刚看到了什么东西？

例如：

> 这是一个塑料袋。

但是用户真正希望记录的可能是：

> 我第一眼把这个塑料袋看成了一只趴着的小狐狸。

普通照片只能保留**现实对象**，无法保存：

> **人的瞬时视觉解释。**

而这类视觉错认往往只有几秒钟。

距离变近、角度改变或者光线变化之后，这种感觉就消失了。

因此产品核心任务不是 Image Generation，而是：

> **Perception Capture —— 捕捉人的视觉联想。**

---

## 3. 产品核心判断

传统 AI Vision 产品通常是：

```text
现实图片
   ↓
AI理解
   ↓
AI告诉用户这是什么
```

例如：

> “这是一只塑料袋。”

而灵感显影是：

```text
现实图片
    +
用户的视觉联想
    ↓
AI理解二者之间的映射
    ↓
将用户脑中的形象描出来
```

因此这里：

**Human = Creative Director**

**AI = Visual Interpreter**

AI 不定义：

> “你应该看到什么。”

AI 只帮助表达：

> “你刚才看到的东西。”

---

## 4. 产品设计原则

### Principle 01：Human First

AI 不能在用户描述之前告诉用户：

> “这个好像狐狸。”

必须让用户先表达自己的视觉联想。

否则用户的想象会受到 AI Anchoring。

正确顺序：

```text
用户观察
↓
用户描述
↓
AI理解
↓
AI显影
```

而不是：

```text
AI识别
↓
用户选择
```

### Principle 02：Preserve Reality

AI 不能把：

> 塑料袋 → 狐狸

直接变成一张普通狐狸插画。

必须让用户依然看得出：

> “狐狸为什么会从这个塑料袋里出现。”

因此：

原始物体结构必须保留。

优先保留：

- 原轮廓
- 朝向
- 姿态
- 光影
- 比例
- 凹凸关系
- 用户圈选区域

### Principle 03：Reveal, Not Generate

产品术语统一使用：

**显影 Reveal**

避免：

“AI绘图”

“生成图片”

“文生图”

因为我们的核心体验不是生成新世界，而是：

> **从现实结构中显现人的想象。**

### Principle 04：Low Friction

从进入产品到第一次显影：

**目标 < 60 秒。**

不要要求用户学习 Prompt Engineering。

用户只需要回答一句：

> 第一眼你把它看成了什么？

---

## 5. 用户

MVP 核心用户：

### Primary

视觉敏感、喜欢观察和记录生活的年轻用户。

包括：

- 设计学生 / 设计师
- 摄影爱好者
- 插画爱好者
- 创作者
- 小红书内容创作者

### Secondary

普通年轻用户。

他们不一定创作，但经常会：

> “卧槽，刚才远远看过去我以为这里有只猫。”

产品需要把这种一次性玩笑式体验变成可保存内容。

---

## 6. 核心 JTBD

> 当我突然把现实中的某个东西看成另外一种形象时，我希望快速保存这种视觉联想，并把它表达出来，因为几秒后这种感觉可能就消失了。

注意：

用户真正需要的不是：

> 帮我画一只猫。

而是：

> **帮我记录为什么我刚才在这里看见了一只猫。**

---

## 7. MVP 范围

10 月 1 日版本只完成一个闭环：

```text
发现灵感
↓
上传图片
↓
选择区域
↓
描述“我看到了什么”
↓
AI理解
↓
轮廓显影
↓
Reality / Reveal 对比
↓
保存灵感卡
```

第一版**不要做**：

- 社区
- 评论
- 点赞
- 关注
- 账号体系
- 复杂画板
- 十种绘画风格
- 专业图像编辑
- 无限生成
- Feed
- 聊天 Agent

这些全部会稀释核心体验。

---

## 8. 产品信息架构

建议最终只有五个页面：

```text
Home
│
├── Capture
│
├── Describe
│
├── Reveal
│
└── Inspiration Detail

Gallery
```

顶部导航不要复杂化。

Mobile：

```text
LOGO                       ◌ 我的灵感
```

Desktop 保持手机内容区居中。

最大主体宽度：

**430–520 px**

目的是让整个产品看起来像一个真正的 Mobile AI 产品，而不是后台管理系统。

---

## 9. User Flow

完整状态流：

```text
HOME
 │
 │ 上传图片 / 体验示例
 ↓
IMAGE_SELECTED
 │
 │ 用户框选区域
 ↓
REGION_SELECTED
 │
 │ 用户输入视觉联想
 ↓
PERCEPTION_ENTERED
 │
 │ 点击「让它显现」
 ↓
AI_UNDERSTANDING
 │
 ↓
TRACE_GENERATING
 │
 ↓
REVEALED
 │
 ├── Before / After
 ├── 保存
 └── 再看一次
```

---

## 10. 页面一：首页 HOME

### 页面目标

用户进入产品 **5 秒内理解它是干什么的**。

### 首屏

Logo：

> Glimpse / 灵感显影

Hero 标题：

> **你刚刚，  
> 把它看成什么了？**

副标题：

> 捕捉现实中一闪而过的视觉联想，  
> 让 AI 沿着你看到的形状，把它描出来。

主按钮：

> ＋ 上传一张照片

次级入口：

> ✦ 先试一个例子

下面放一个最重要的示例。

### 首页示例

建议默认就是：

**塑料袋 → 狐狸**

视觉结构：

```text
远处看到的塑料袋

        ↓

“等等……像不像一只狐狸？”

        ↓

线条慢慢显现狐狸轮廓
```

不要展示两张完全不同的图片。

应该使用**同一张照片**。

第二态只是覆盖了一层手绘线。

这样用户才能瞬间理解整个产品。

---

## 11. 页面二：Capture

用户上传照片后进入。

标题：

> **哪里让你看走眼了？**

辅助说明：

> 圈出让你产生联想的区域。

### 图片操作

主体为上传照片。

用户可以：

矩形拖选区域。

MVP 不需要真正自由 Brush。

建议先实现：

**Bounding Box**

理由：

- 开发简单
- 不容易出 Bug
- 移动端操作稳定
- 足够表达 Region Grounding

框选区域：

正常亮度。

非框选区域：

加 20% 黑色透明蒙层。

区域边框：

1.5px 白色。

四角：

8px corner handle。

### 操作按钮

底部固定：

> 重新上传

主按钮：

> 就是这里 →

只有存在 selection 时主按钮可点击。

---

## 12. 页面三：Describe

标题：

> **第一眼，你把它看成了什么？**

副标题：

> 不用描述它实际上是什么。  
> 告诉我你刚才脑海里看到的东西。

输入区域为大号 textarea。

Placeholder：

> 例如：一只蜷缩着睡觉的小狐狸

建议最多：

**100 字。**

### Prompt Chips

下面提供轻量辅助：

```text
它的方向？
它在做什么？
哪个地方最像？
```

点击并不会自动填写答案，而是在 placeholder 中给提示。

避免让用户写复杂 Prompt。

### CTA

> ✦ 让它显现

点击进入显影阶段。

---

## 13. AI 理解阶段

这是 AI 产品感非常重要的一步。

不能：

点击 → Loading → 图片。

需要让用户感受到：

> AI 理解了“现实结构”和“人的联想”的关系。

建议加载过程中依次出现：

### Step 1

> 正在寻找你看到的轮廓……

图片里的 selection 微微呼吸。

### Step 2

> 正在理解形态关系……

开始出现少量淡线。

### Step 3

> 正在把想象描出来……

完整轮廓逐渐出现。

总时间：

**2.5–4 秒。**

即使是假 Demo，也不要 0.2 秒完成。

AI 产品需要合理的 perceived latency。

---

## 14. 核心功能：Reveal

这是整个作品最重要的页面。

标题：

> **原来你刚刚看见的是它。**

下方：

原始图片。

上面叠加 SVG / Canvas 轮廓。

例如狐狸：

```text
原塑料袋

+

狐狸耳朵
狐狸眼睛
鼻子
背部线
尾巴
```

不要完全覆盖原照片。

建议 AI 线条：

半透明白色 / 暖白。

Stroke：

2–2.5px。

稍微带一点 hand-drawn wobble。

---

## 15. Reveal 动画

不要一下出现全部轮廓。

SVG：

```css
stroke-dasharray
stroke-dashoffset
```

让路径从头到尾逐渐绘制。

推荐：

**1.8–2.8 秒。**

效果应类似：

> “它真的从照片里长出来了。”

---

## 16. Reality / Perception 对比

结果页面核心交互：

一个 Slider。

左边：

> REALITY

右边：

> I SAW

拖动中间分割线。

左侧：

原图。

右侧：

原图 + 显影线稿。

这比：

原图 | 生成图

更适合本产品。

---

## 17. 灵感结果文案

图片下方：

### 我看到

> 一只蜷缩着睡觉的小狐狸

下面：

> 现实中的它：一团塑料袋

注意：

**“现实中的它是什么”可以暂时不让 AI 自动识别。**

MVP 甚至可以不展示。

重点始终是：

用户 perception。

---

## 18. 保存灵感

按钮：

> ♡ 收藏这一瞬间

保存后：

> 已放进你的灵感册

---

## 19. 我的灵感 Gallery

简单 Masonry / Grid。

两列。

Card 结构：

```text
[Photo]

一只蜷缩的小狐狸

今天 16:24
```

Mouse hover / tap：

自动显示显影结果。

再点击进入详情。

---

## 20. Inspiration Detail

打开保存记录。

顶部：

> 2026 / 09 / 30 · 16:24

正文：

> 那一瞬间，我看见了……

### 图片区域

Reality / I Saw Slider。

### 用户原始描述

> 一只蜷缩起来睡觉的小狐狸。

下方：

> 再显影一次

MVP 可以不用真的支持。

---

## 21. Demo 必须提供预置案例

这是非常关键的工程策略。

**不要把面试作品成败押在实时模型 API 上。**

至少预置三个可以 100% 成功的 Hero Cases：

| Reality | Perception | 显影内容 |
|---|---|---|
| 塑料袋 | 蜷缩的小狐狸 | 耳朵、眼睛、鼻子、尾巴 |
| 墙面裂纹 | 老人的侧脸 | 额头、鼻梁、嘴、下巴 |
| 咖啡渍 | 海上的小岛 | 山体、树、海岸线 |

首页：

> ✦ 先试一个例子

直接进入第一个 Hero Case。

这一条路径必须做到：

**零失败。**

---

## 22. 为什么一定要保留“上传图片”

因为面试官看到 Demo 时会判断：

> 这是不是 PPT 式假产品？

所以 UI 上必须存在：

**上传自己的图片**

并且上传、框选、描述都真实可操作。

至于最终 AI 显影，如果 REDcowork 无法稳定调用模型，可以采用：

### Demo Mode

预置案例拥有真正对应的 SVG。

### Prototype Mode

用户上传任意图片后：

- 完成上传
- 完成框选
- 完成描述
- 进入 AI processing
- 提供一个通用实验结果

但不要谎称模型能力已经完成。

如果面试中被问，可以说明：

> 这个版本主要验证人先感知、AI 后显影的核心交互闭环。目前 Demo 使用预制样本保证展示稳定，真正产品化后显影层需要接入视觉理解与生成模型。

---

## 23. 前端技术方案

为了 REDcowork 迁移风险最低，建议：

```text
React
+
TypeScript
+
Vite
+
CSS / Tailwind
+
SVG
+
localStorage
```

不要：

- Next.js Server Components
- Node backend
- 数据库
- SSR
- Server Actions
- 复杂鉴权
- Docker

最终构建：

```bash
npm run build
```

能够生成标准：

```text
dist/
```

---

## 24. 推荐依赖

尽量少。

核心：

```text
react
react-dom
typescript
vite
lucide-react
```

如果 REDcowork 对 npm 包兼容不错：

```text
framer-motion
```

否则动画直接 CSS。

图片框选不建议装巨型库。

直接实现：

Pointer Events。

---

## 25. 项目目录

建议使用：

```text
src/
├── assets/
│   ├── samples/
│   │   ├── fox.jpg
│   │   ├── wall.jpg
│   │   └── coffee.jpg
│   └── overlays/
│       ├── fox.svg
│       ├── face.svg
│       └── island.svg
│
├── components/
│   ├── Header.tsx
│   ├── PrimaryButton.tsx
│   ├── ImageUploader.tsx
│   ├── SelectionBox.tsx
│   ├── RevealCanvas.tsx
│   ├── RevealSlider.tsx
│   ├── LoadingSequence.tsx
│   ├── InspirationCard.tsx
│   └── ExampleCard.tsx
│
├── pages/
│   ├── Home.tsx
│   ├── Capture.tsx
│   ├── Describe.tsx
│   ├── Reveal.tsx
│   └── Gallery.tsx
│
├── data/
│   └── samples.ts
│
├── hooks/
│   └── useLocalStorage.ts
│
├── types/
│   └── inspiration.ts
│
├── store/
│   └── appStore.ts
│
├── App.tsx
├── main.tsx
└── index.css
```

---

## 26. 数据模型

```typescript
type Inspiration = {
  id: string;
  sourceImage: string;

  selection: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  perceptionText: string;

  revealOverlay?: string;

  createdAt: number;

  mode: "sample" | "upload";
};
```

Selection 一律使用：

**0–1 normalized coordinates**

而不是像素。

例如：

```typescript
{
  x: 0.21,
  y: 0.35,
  width: 0.42,
  height: 0.33
}
```

这样不同屏幕尺寸不会错位。

---

## 27. 应用状态

建议使用简单 state machine。

```typescript
type AppStage =
  | "home"
  | "capture"
  | "describe"
  | "processing"
  | "reveal"
  | "gallery";
```

核心状态：

```typescript
{
  stage,
  image,
  selection,
  perceptionText,
  overlay,
  inspirations
}
```

不需要 Redux。

---

## 28. AI Provider 抽象

即使第一版使用预制数据，也必须把 AI 层抽象出来。

例如：

```typescript
interface RevealProvider {
  reveal(input: RevealInput): Promise<RevealResult>;
}
```

两个实现：

```text
MockRevealProvider
LiveRevealProvider
```

第一版：

```text
MockRevealProvider
```

后面如果 REDcowork 支持模型：

只替换：

```text
LiveRevealProvider
```

UI 全部不用改。

---

## 29. AI 返回 Schema

真正接模型时统一要求：

```json
{
  "interpretation": {
    "subject": "fox",
    "pose": "curled up",
    "direction": "left"
  },
  "mapping": [
    {
      "feature": "head",
      "region": [0.18, 0.24]
    },
    {
      "feature": "tail",
      "region": [0.74, 0.62]
    }
  ],
  "overlay": "<svg>...</svg>"
}
```

理想状态是模型直接输出 SVG。

因为核心不需要生成位图。

技术方案重点是：

> **用结构化视觉理解 + SVG Overlay，而不是重型 Diffusion 生成。**

---

## 30. AI Prompt 规格

以后接模型时 System Prompt 可以按照：

```text
You are a visual perception interpreter.

The user has already perceived an imagined subject
inside a real-world visual pattern.

Your task is NOT to identify what the real object is.

Your task is NOT to replace the original image.

Instead:

1. Respect the user's interpretation as the intended concept.
2. Analyze the selected region's existing structure.
3. Map recognizable visual features of the user's imagined
   subject onto the existing contours.
4. Preserve the original orientation, proportions and spatial structure.
5. Add only the minimum visual strokes necessary to make
   the imagined form perceptible.
6. Return a simple SVG line overlay.
7. Avoid filling the entire object.
8. Prefer 5–15 expressive strokes.

The result should feel like:
"I can suddenly see what the user saw."
```

User 输入：

```text
Perception:
“一只蜷缩着睡觉的小狐狸”

Selected image region:
[image]
```

---

## 31. UI 视觉规范

设计关键词：

**Editorial / Observation / Quiet / Human / Creative**

不要做科技蓝 AI 产品。

主背景：

```text
#F4F1EA
```

或者偏暖白。

文字：

```text
#171717
```

Card：

```text
#FFFFFF
```

强调色只使用一种。

例如橙红：

```text
#FF5A45
```

但不要大面积使用“小红书红”。

避免像在模仿小红书 UI。

---

## 32. 字体

优先系统字体。

中文：

```css
-apple-system,
BlinkMacSystemFont,
"PingFang SC",
"Microsoft YaHei",
sans-serif
```

标题：

600–700。

正文：

400。

---

## 33. 动效规范

这个产品的动效非常重要。

核心不是页面飞来飞去。

只需要三种。

### A. Image breathe

Processing：

```text
scale 1 → 1.015 → 1
```

2 秒循环。

### B. SVG Draw

核心。

```text
stroke-dashoffset
```

实现绘制过程。

### C. Fade

文案逐条出现。

其它动效全部克制。

---

## 34. Responsive

### Mobile

375px 为基准。

主体铺满。

图片宽：

```text
calc(100vw - 32px)
```

### Desktop

内容居中。

```css
max-width: 480px
```

两侧留空。

不要为了桌面强行改成三栏。

因为整个产品设计语言本身就是：

**随手记录灵感。**

---

## 35. 异常状态

### 图片过大

> 图片有点大，我们帮你压缩一下。

前端压缩。

### 未选择区域

Button disabled。

### 未输入内容

> 告诉我你刚刚看到了什么。

### 上传失败

> 这张照片没有成功打开，再试一次。

### Reveal 失败

不要白屏。

显示：

> 这次没有成功显现出来。

按钮：

> 再试一次

---

## 36. 数据持久化

MVP：

```text
localStorage
```

保存：

用户 inspirations。

但图片如果是 Base64 可能超容量。

因此 Demo 最多保存：

6 条。

或者只保存：

sample IDs。

不用为这次考试解决真正 Cloud Storage。

---

## 37. 埋点逻辑

即使不真正接埋点，也建议在产品文档保留。

核心 Funnel：

```text
home_view
↓
image_uploaded
↓
region_selected
↓
perception_submitted
↓
reveal_completed
↓
inspiration_saved
```

核心成功指标：

### Reveal Completion Rate

```text
reveal_completed /
image_uploaded
```

### Time to Reveal

从：

```text
image_uploaded
```

到：

```text
reveal_completed
```

目标：

**<60s**

### Perception Match

结果页：

> 和你刚刚看到的一样吗？

三个按钮：

```text
就是这个
有点像
不像
```

真正产品中，这会是核心 AI Quality Metric。

---

## 38. MVP 验收标准

10 月 1 日提交之前必须保证：

| 功能 | 验收 |
|---|---|
| 首页 | 首屏 5 秒理解产品 |
| 示例 | 狐狸案例 100% 正常 |
| 上传 | 本地图片成功显示 |
| 框选 | PC 鼠标可操作 |
| 描述 | 可输入文本 |
| Processing | 至少 3 阶段反馈 |
| Reveal | SVG 绘制动画完整 |
| Slider | Reality / I Saw 可拖动 |
| 收藏 | 可保存到 Gallery |
| 刷新 | 示例链路无报错 |
| 响应式 | 375px 及 Desktop 正常 |
| 部署 | REDcowork 链接无需额外操作即可打开 |

最重要的是：

> **狐狸 Hero Case 必须 100% 成功。**

---

## 39. V1 以后才考虑的功能

### AI 还看到了什么

用户第一次 Reveal 完成以后：

> ✦ AI 还看到了另外两种可能

不会污染第一次人类想象。

### Inspiration Remix

把显影结果进一步转化为：

- 角色
- Logo
- 纹样
- 插画

### Same Reality, Different Eyes

同一张图片：

> 你看见狐狸  
> A 看见小狗  
> B 看见一座山

这个功能非常适合社区。

### Camera Mode

打开摄像头。

实时捕捉世界里的视觉联想。

这可以成为长期想象空间。

---

## 40. 产品核心表达

后续笔试、面试和 Demo 讲解都围绕这一句话展开：

> **我不希望 AI 替用户产生想象，而是希望它降低人表达想象的门槛。**

这就是产品最核心的 AI 判断。
