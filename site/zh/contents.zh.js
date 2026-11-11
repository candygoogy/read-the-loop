// Chinese captions for the contents page's pictures (site/zh/index.html), read by site/contents.js.
// Same keys as the English captions there. Numbers never appear here: each function gets `d`, the values
// contents.js reads from the recordings, already formatted for zh-CN.
window.CONTENTS_COPY = {
  locale: "zh-CN",
  loop: (d) => `${d.calls} 次调用，每次都读入整段对话：开始时 ${d.first} 个 token，结束时 ${d.last} 个`,
  context: (d) => `${d.calls} 次调用中的最后一次读入了 ${d.last} 个 token。每个方块是 ${d.unit} 个。`,
  cache: (d) => `${d.calls} 次调用读入的内容里，${d.pct} 是从缓存读取的`,
  compaction: (d) => `压缩前对话有 ${d.pre} 个 token，压缩后剩 ${d.post} 个。面积按比例绘制。`,
  tools: (d) => `第一次请求的字符里：工具说明占 ${d.tools}，系统部分占 ${d.system}，消息占 ${d.messages}`,
  subagents: (d) => `子智能体的对话涨到了 ${d.peak} 个 token；交回报告之后，主对话只多了 ${d.growth} 个。`,
  failure: (d) => `${d.runs} 次运行，每次一列，模型发出的每个请求是一块：${d.requests} 个请求中有 ${d.refused} 个被权限检查拒绝（斜纹）`,
};
