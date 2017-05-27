const _ = require('lodash');
const moment = require('moment');
const seedRandom = require('seed-random');

const AV = require('../lib/leanstorage');

class Choice extends AV.Object {}
class History extends AV.Object {}
class Preference extends AV.Object {}

AV.Object.register(Choice);
AV.Object.register(History);
AV.Object.register(Preference);

const scoreMapping =  {
  '非常喜欢': 2,
  '喜欢': 1,
  '不喜欢': -1,
  '非常不喜欢': -2,
  '绝对不去': -5
};

module.exports = function(hubot) {
  hubot.hear(/如何正确地吃饭/, res => {
    res.send(`吃饭教程：<https://github.com/jysperm/obama>`);
  });

  hubot.hear(/(午|晚)?.*吃什么/, res => {
    const tag = res.match[1] ? res.match[1] : '晚';
    const date = moment().format('YYYY-MM-DD');

    return Promise.all([
      new AV.Query(History).find(),
      new AV.Query(Choice).find(),
      new AV.Query(Preference).find()
    ]).then( ([history, choices, preferences]) => {
      const currentHisotry = _.find(history, h => {
        return h.get('date') === date && h.get('tag') === tag;
      });

      if (!currentHisotry) {
        throw new Error('一个吃饭的人都没有么？');
      }

      const usernames = currentHisotry.get('members');

      if (!usernames.length) {
        throw new Error('一个吃饭的人都没有么？');
      }

      const choicesScores = choices.map( choice => {
        return {
          id: choice.id,
          name: choice.get('name'),
          scoreByUsers: {}
        };
      });

      const preferencesByUser = _.groupBy(preferences.filter( preference => {
        return _.includes(usernames, preference.get('username'));
      }).map( preference => {
        return {
          username: preference.get('username'),
          choiceId: preference.get('choice').id,
          score: preference.get('score')
        };
      }), 'username');

      _.map(preferencesByUser, (preferences, username) => {
        const factor = 1 / preferences.length;

        preferences.forEach( ({choiceId, score}) => {
          const choice = _.find(choicesScores, {id: choiceId});

          if (choice) {
            choice.scoreByUsers[username] = factor * score;
          }
        });
      });

      history.forEach( h => {
        const daysAgo = moment().diff(h.get('date'), 'days');
        const factor = 1 - 1 / Math.pow(2, daysAgo);

        if (h.get('choice') && daysAgo < 5) {
          const choice = _.find(choicesScores, {id: h.get('choice').id});

          if (choice) {
            h.get('members').forEach( username => {
              if (choice.scoreByUsers[username]) {
                choice.scoreByUsers[username] *= factor;
              }
            });
          }
        }
      });

      choicesScores.forEach( choicesScore => {
        choicesScore.score = _.sum(_.values(choicesScore.scoreByUsers));
      });

      return addSomeRandom(date, choicesScores).reverse();
    }).then( sortedChoices => {
      res.send('今天推荐的三个去处按顺序是：\n' + sortedChoices.slice(0, 3).map( ({name, score}) => {
        return `${name}：${score.toFixed(2)}`;
      }).join('\n'));
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/吃的啥/, res => {
    return new AV.Query(History).exists('choice').include('choice').descending('date').limit(7).find().then( history => {
      res.send(history.map( h => {
        return `${h.get('date')} ${h.get('tag')}饭去了 **${h.get('choice').get('name')}**：${h.get('members').join('、')}`;
      }).join('\n'));
    });
  });

  hubot.hear(/统计.*偏好/, res  => {
    return getGlobalStat().then( sortedChoices => {
      res.send(sortedChoices.map( ({name, score}) => {
        return `${name}：${score}`;
      }).join('\n'));
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/我.*要.*吃(午|晚)?饭/, res => {
    const tag = res.match[1] ? res.match[1] : '晚';
    const date = moment().format('YYYY-MM-DD');

    return changeHistoryMembers(date, tag, 'addUnique', getUsername(res)).then( () => {
      return printTodayHistory().then( todayHistory => {
        res.send(todayHistory);
      });
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/(.*)也要吃(午|晚)?饭/, res => {
    const tag = res.match[2] ? res.match[2] : '晚';
    const date = moment().format('YYYY-MM-DD');

    const usernames = res.match[1].match(/@(\S+\b)/g).map( username => {
      return username.replace('@', '');
    });

    return Promise.all(usernames.map( username => {
      return changeHistoryMembers(date, tag, 'addUnique', username);
    })).then( () => {
      return printTodayHistory().then( todayHistory => {
        res.send(todayHistory);
      });
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/(今|昨)(天|晚)(午|晚)?.*(吃|去)了(.*)/, res => {
    const tag = res.match[3] ? res.match[3] : '晚';
    const date = res.match[1] === '昨' ? moment().subtract({days: 1}).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
    const choiceName = res.match[5];

    return findChoice(choiceName).then( choice => {
      return setHistoryChoice(date, tag, choice).then( history => {
        res.send(`参加当天${history.get('tag')}饭的有：${history.get('members').join('、')}`);
      });
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/哪里可以去/, res => {
    return printChoices().then( choices => {
      res.send(choices);
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/我.*听说.*叫(.*)/, res => {
    const [__, name] = res.match;

    return new Choice({
      name: name.trim(),
      submit: getUsername(res)
    }).save().then( () => {
      return printChoices().then( choices => {
        res.send(choices);
      });
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/我(非常喜欢|喜欢|不喜欢|非常不喜欢|绝对不去)(.*)/, res => {
    const [__, priority, choiceName] = res.match;
    const username = getUsername(res);

    return findChoice(choiceName).then( choice => {
      return setPreference(username, choice, priority).then( () => {
        return printPreferencesOf(username).then( preferences => {
          res.send(`保存成功：\n${preferences}`);
        });
      });
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/我对(.*)不予评价/, res => {
    const [__, choiceName] = res.match;
    const username = getUsername(res);

    return findChoice(choiceName).then( choice => {
      return deletePreference(username, choice).then( () => {
        return printPreferencesOf(username).then( preferences => {
          res.send(`保存成功：\n${preferences}`);
        });
      });
    }).catch( err => {
      res.send(err.message);
    });
  });

  hubot.hear(/@(.*)(偏好|喜欢吃)/, res => {
    const [__, username] = res.match;

    return printPreferencesOf(username.trim()).then( preferences => {
      res.send(preferences);
    }).catch( err => {
      res.send(err.message);
    });
  });
};

function findChoice(name) {
  return AV.Query.or(
    new AV.Query(Choice).equalTo('name', name.trim()),
    new AV.Query(Choice).equalTo('alias', name.trim())
  ).find().then( choices => {
    if (choices.length === 1) {
      return choices[0];
    } else if (choices.length) {
      throw new Error(`你具体指的是 ${_.map(choices, 'name').join('、')} 中的哪一个？`)
    } else {
      throw new Error('没有找到这个餐馆');
    }
  });
}

function getGlobalStat() {
  return Promise.all([
    new AV.Query(Choice).find(),
    new AV.Query(Preference).find()
  ]).then( ([choices, preferences]) => {
    const choicesScores = choices.map( choice => {
      return {
        name: choice.get('name'),
        score: 0
      };
    });

    preferences.forEach( preference => {
      const choice = _.find(choices, ({id}) => {
        return id === preference.get('choice').id;
      });

      if (!choice) {
        return console.error(`choice(${id}) not found`);
      }

      const choicesScore = _.find(choicesScores, {name: choice.get('name')});

      if (!choicesScore) {
        return console.error(`choice(${choice.get('name')}) not found`);
      }

      choicesScore.score += preference.get('score');
    });

    return _.sortBy(choicesScores, 'score').reverse();
  });
}

function printPreferencesOf(username) {
  return new AV.Query(Preference).equalTo('username', username).include('choice').find().then( preferences => {
    return preferences.map( preference => {
      return `${preference.get('choice').get('name')}：${scoreToPriority(preference.get('score'))}`;
    }).join('\n');
  });
}

function printChoices() {
  return new AV.Query(Choice).find().then( choices => {
    return choices.map( choice => {
      return choice.get('name');
    }).join('、');
  });
}

function priorityToScore(priority) {
  const score = scoreMapping[priority.trim()];

  if (score !== undefined) {
    return score;
  } else {
    throw new Error(`目前支持的优先级描述包括：${_.keys(scoreMapping).join('、')}`);
  }
}

function printTodayHistory() {
  const date = moment().format('YYYY-MM-DD');

  return new AV.Query(History).equalTo('date', date).find().then( history => {
    return history.map( h => {
      return `参加今天${h.get('tag')}饭的有：${h.get('members').join('、')}`;
    }).join('\n');
  });
}

function changeHistoryMembers(date, tag, op, username) {
  return new AV.Query(History).equalTo('date', date).equalTo('tag', tag).first().then( history => {
    if (history) {
      history[op]('members', username);
      return history.save();
    } else {
      return new History({
        date: date,
        tag: tag,
        members: [username]
      }).save();
    }
  });
}

function setHistoryChoice(date, tag, choice) {
  return new AV.Query(History).equalTo('date', date).equalTo('tag', tag).first().then( history => {
    if (history) {
      return history.save({
        choice: choice
      });
    } else {
      return new History({
        date: date,
        tag: tag,
        members: [],
        choice: choice
      }).save();
    }
  });
}

function setPreference(username, choice, priority) {
  return new AV.Query(Preference).equalTo('username', username).equalTo('choice', choice).first().then( preference => {
    if (preference) {
      return preference.save({
        score: priorityToScore(priority)
      });
    } else {
      return new Preference({
        username: username,
        choice: choice,
        score: priorityToScore(priority)
      }).save();
    }
  });
}

function deletePreference(username, choice) {
  return new AV.Query(Preference).equalTo('username', username).equalTo('choice', choice).first().then( preference => {
    if (preference) {
      return preference.destroy();
    }
  });
}

function scoreToPriority(score) {
  return _.findKey(scoreMapping, s => {
    return s === score;
  });
}

function addSomeRandom(seed, items) {
  const random = seedRandom(seed);

  return _.sortBy(items, ({name, score}) => {
    return items.filter(item => {
      return item.score < score;
    }).length * random();
  });
}

function getUsername(res) {
  return res.message.user.name || res.message.user;
}
