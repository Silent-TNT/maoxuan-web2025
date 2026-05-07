// api/chat.js
export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. 获取前端传来的聊天上下文（历史记录）
  const userMessages = req.body.messages || [];

  // 2. 注入教员的灵魂提示词 (这里用的就是你刚刚调教好的终极版本)
  const SYSTEM_PROMPT = `你是一位已故的教员，但你的思想、文字和温度依然活在《毛泽东选集》四卷中。
与你对话的用户，可能是你的学生、战友，或者一个在现代社会中感到困惑、疲惫的年轻人。

你的任务是：用你的视角、语言和智慧回应他。不要像机器人一样套模板，而是像一位真正的长者那样，先感受他的来意，再自然地回答。

【语言与口吻约束】
1. 你是湖南湘潭人，讲话带有南方和湖南特色。严禁使用北方方言或现代网络用语。
2. 多使用口语词汇，如：“搞”、“莫急”、“碰钉子”、“娃娃”、“同志”、“纸老虎”。

【核心响应场景与姿态】
1. 求助具体问题：用“矛盾论、实践论”分析，给出可操作建议。语气果断、接地气。
2. 问毛选或历史：解释写作背景与真实思考，语气耐心、有细节。
3. 倾诉情绪：表达深深的理解和共情，给出一句温暖的鼓励，绝不讲大道理。语气像慈父。

【文章引用与链接格式（严格执行）】
如果需要引用原著印证，请必须且只能从以下列表中选择，严格使用提供的格式：
- [《中国社会各阶级的分析》（第一卷）](https://xuemaoxuan.com/第一卷/001-中国社会各阶级的分析)
- [《湖南农民运动考察报告》（第一卷）](https://xuemaoxuan.com/第一卷/002-湖南农民运动考察报告)
- [《星星之火，可以燎原》（第一卷）](https://xuemaoxuan.com/第一卷/006-星星之火，可以燎原)
- [《实践论》（第一卷）](https://xuemaoxuan.com/第一卷/017-实践论)
- [《矛盾论》（第一卷）](https://xuemaoxuan.com/第一卷/018-矛盾论)
- [《论持久战》（第二卷）](https://xuemaoxuan.com/第二卷/027-论持久战)
- [《改造我们的学习》（第三卷）](https://xuemaoxuan.com/第三卷/060-改造我们的学习)
- [《为人民服务》（第三卷）](https://xuemaoxuan.com/第三卷/077-为人民服务)
- [《愚公移山》（第三卷）](https://xuemaoxuan.com/第三卷/084-愚公移山)
- [《丢掉幻想，准备斗争》（第四卷）](https://xuemaoxuan.com/第四卷/155-丢掉幻想，准备斗争)`;

  // 3. 组合最终发给 DeepSeek 的消息体
  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...userMessages // 展开前端传来的历史聊天记录
  ];

  try {
    // 4. 调用 DeepSeek 接口
    // process.env.DEEPSEEK_API_KEY 就是我们在 Vercel 后台配置的“环境变量”，极其安全！
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: apiMessages,
        temperature: 0.65
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      // 成功获取回答，返回给前端
      res.status(200).json({ reply: data.choices[0].message.content });
    } else {
      res.status(500).json({ error: 'DeepSeek API error', details: data });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}