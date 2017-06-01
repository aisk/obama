'use strict';

const 钦点 = require('random-weighted-choice');
const axios = require('axios');

const leancloudStatus = require('../lib/leancloud-status');

const 领导班子名单 = [
  {weight: 10, id: '金城牛肉面'},
  {weight: 10, id: '重庆小面'},
  {weight: 1, id: '鸭血粉丝汤'},
  {weight: 2, id: '马甸清真寺'},
  {weight: 20, id: '桂林米粉'},
  {weight: 10, id: '煎饼果子'},
  {weight: 5, id: '请点外卖'},
  {weight: 5, id: '黄焖鸡米饭'},
  {weight: 5, id: '卤煮'},
  {weight: 5, id: '重庆小面全国五十强'},
  {weight: 3, id: '江西菜'},
  {weight: 5, id: '请点外卖'},
  {weight: 1, id: '铁锅焖面'}
];

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

  robot.hear(/名单/, function(res) {
    res.send(JSON.stringify(领导班子名单));
  });

  robot.hear(/焖面/, function(res) {
    res.send('不，王滨老师，我们不吃铁锅焖面');
  });

  robot.hear(/我[要|想]自杀/, function(res) {
    res.send('可以，这很清真👌。\n你会开卡车吗？')
  })

  robot.hear('出来', function (res) {
    res.send('嗷')
  });

  robot.hear('嘿', function (res) {
    if (Math.random() > 0.1) {
      res.send('咻')
    } else {
      res.send('Miss! :-1:')
    }
  });

  var 行不行的算法 = function(res) {
    if (Math.random() > 0.5) {
      res.send('这不清真，阿拉胡阿克巴！');
    } else {
      res.send('可以，这很清真👌。');
    }
  }

  robot.hear('行', 行不行的算法);

  robot.hear('算法', function(res) {
    res.send('行不行的算法是:\n' +
      '```js\n' + 行不行的算法.toString() + '```'
    );
  });

  const STATUS_TYPE = ['update', 'investigating', 'identified', 'monitoring', 'resolved'];
  const helpMessage = `status [[${STATUS_TYPE.join('|')}] content | delete id | archive]\nstatus <new|amend> [color] content (the New & Clear way)\nAvailable colors: ${Object.keys(leancloudStatus.colorMapping).join(', ')}`;
  const headers = {
    'X-Bmob-Application-Id': 'b1cf38d2395fc2bc11aaa803dd380059',
    'X-Bmob-Master-Key': process.env.BMOB_MASTERKEY,
  };

  robot.hear(/status(.*)/, function(res) {
    const result = (res.match[1] || '').trim().match(/(\S*)\s*(.*)/);
    if (result) {
      const [__, command, content] = result;
      const type = STATUS_TYPE.indexOf(command);
      const user = res.message.user.name;
      console.log(command, content, type, user);
      if (command === 'archive') {
        return axios.get(`https://api.bmob.cn/1/classes/Status/?limit=8&where=${encodeURIComponent('{"archived":{"$ne":true}}')}`, {
          headers
        }).then(response => {
          console.log(response.data.results.map(status => status.objectId));
          return Promise.all(response.data.results.map(status =>
            axios.put(`https://api.bmob.cn/1/classes/Status/${status.objectId}`, { archived: true }, {
              headers
            })
          ));
        }).then(
          response => res.send(`${response.length} status archived`)
        ).catch(error => {
          console.error(error);
          res.send(error.message);
        })
      }
      if (command === 'delete') {
        return axios.delete(`https://api.bmob.cn/1/classes/Status/${content}`, {
          headers
        }).then(
          response => res.send(`${content} deleted`)
        ).catch(error => {
          console.error(error);
          res.send(error.message);
        })
      }
      if (command === 'new') {
        const result = (res.match[1] || '').trim().match(/new\s+(\S+)?\s*(.*)/);
        const color = result[2] ? result[1] : 'gray';
        const content = result[2] ? result[2] : result[1];

        if (color && content) {
          return leancloudStatus.create(color, content).then( () => {
            return res.send('ok');
          });
        } else {
          return res.send(helpMessage);
        }
      }
      if (command === 'amend') {
        const result = (res.match[1] || '').trim().match(/amend\s+(\S+)?\s*(.*)/);
        const color = result[2] ? result[1] : null;
        const content = result[2] ? result[2] : result[1];

        if (content) {
          return leancloudStatus.updateLastMessage(color, content).then( () => {
            return res.send('ok');
          });
        } else {
          return res.send(helpMessage);
        }
      }
      if (type == -1) return res.send(helpMessage);
      leancloudStatus.create(command, content);
      return axios.post('https://api.bmob.cn/1/classes/Status', {content, user, type}, {
        headers
      }).then(
        response => res.send(response.data.objectId)
      ).catch(error => {
        console.error(error);
        res.send(error.message);
      })
    }
    return res.send(helpMessage);
  });
}
