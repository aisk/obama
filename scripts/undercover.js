'use strict';

module.exports = function(robot) {
  robot.on('deploy', function() {
    robot.send('asaka', '明明三年，三年之后又三年，就快十年了，老大！');
  });
}
