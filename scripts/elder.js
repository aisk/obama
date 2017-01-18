'use strict';

const 钦点 = require('random-weighted-choice');

module.exports = function(robot) {
  let poem = '苟利国家生死以岂因福祸避趋之';

  robot.hear(/念.*诗/, function(res) {
    res.send(poem);
  });

  robot.hear(/苟/, function(res) {
    res.send('苟日新，日日新，又日新。');
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
      {weight: 1, id: '鸭血粉丝汤'},
      {weight: 5, id: '马甸清真寺'},
      {weight: 10, id: '煎饼果子'},
      {weight: 5, id: '请点外卖'},
      {weight: 1, id: '不，王滨老师，我们不吃铁锅焖面'}
    ])}**`);
  });

  robot.hear(/焖面/, function(res) {
    res.send('不，王滨老师，我们不吃铁锅焖面');
  });
}
