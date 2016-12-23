'use strict';

const 钦点 = require('random-weighted-choice');

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
      president = res.random(['唐纳德·特朗普']);
    } else {
      president = res.random(president.split(','));
    }
    res.send(
      `你们选的这个**${president}**啊，excited！`
    );
  });

  robot.hear(/吃/, function(res) {
    res.send(`**${钦点([
      {weight: 10, id: '金城牛肉面'},
      {weight: 10, id: '重庆小面'},
      {weight: 10, id: '鸭血粉丝汤'},
      {weight: 5, id: '马甸清真寺'},
      {weight: 100, id: '煎饼果子'},
      {weight: 5, id: '请点外卖'}
    ])}**`);
  });
}
