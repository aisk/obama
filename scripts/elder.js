'use strict';

module.exports = function(robot) {
  let poem = '苟利国家生死以岂因福祸避趋之';
  for (let i=0; i<poem.length-1; i++) {
    let word = poem[i];
    robot.hear(new RegExp(word), function(res) {
      res.send(poem[i+1]);
    });
  }

  robot.hear(/念.*诗/, function(res) {
    robot.emit('deploy');
    res.send(poem);
  });

  robot.hear(/钦点(.*)/, function(res) {
    let president = res.match[1];
    if (!president) {
      president = res.random(['唐纳德·特朗普', '希拉里·克林顿']);
    } else {
      president = res.random(president.split(','));
    }
    res.send(
      `你问我啊，我可以回答你一句“无可奉告”，你们也不高兴，那怎么办？我讲的意思不是我钦点**${president}**当下任美国总统。你问我支持不支持，我是支持的，我就明确地告诉你这一点。`
    );
  });

  robot.hear(/今晚吃啥/, function(res) {
    res.send(`**${res.random(['金城牛肉面', '重庆小面', '鸭血粉丝汤'])}**`);
  });
}
