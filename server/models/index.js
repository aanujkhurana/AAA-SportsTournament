// Central export file for all database models
const User = require('./User');
const Tournament = require('./Tournament');
const Registration = require('./Registration');
const Payment = require('./Payment');
const Fixture = require('./Fixture');
const Notification = require('./Notification');

module.exports = {
  User,
  Tournament,
  Registration,
  Payment,
  Fixture,
  Notification
};