const inquirer = require('inquirer');
const emoji = require('node-emoji');
const { spawnSync, spawn } = require('child_process');

const fuzzy = require('fuzzy');

const { MAX_LENGTH_TITLE, MAX_LENGTH_DESCRIPTION } = require('./constants');
const emojis = require('./emojis');

const onMissing = (name) => {
  switch (name) {
    case 'camera_flash':
      return emoji.emojify(':camera_with_flash:');
    case 'robot':
      return emoji.emojify(':robot_face:');
    default:
      return name;
  }
};

const emojiList = Object.values(emojis).map(value => emoji.emojify(value, onMissing));

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

const prompts = [
  {
    type: 'autocomplete',
    name: 'emoji',
    message: 'Which gitmoji would you like to use?',
    pageSize: 5,
    source(answersSoFar, input) {
      if (!input) {
        return Promise.resolve(emojiList);
      }

      return Promise.resolve(fuzzy.filter(input, emojiList).map(item => item.string));
    },
  },
  {
    name: 'title',
    message: 'Please enter your commit title',
    transformer: (input) => {
      if (input.length > MAX_LENGTH_TITLE) {
        return emoji.emojify(
          `[${
            input.length
          }/${MAX_LENGTH_TITLE}]: ${input}\n:warning:  Your commit title might get truncated`,
        );
      }
      return `[${input.length}/${MAX_LENGTH_TITLE}]: ${input}`;
    },
    validate: input => !!input.trim(),
  },
  {
    name: 'description',
    message: 'Please enter an optional commit description',
    transformer: input => `[${input.length}/${MAX_LENGTH_DESCRIPTION}]: ${input}`,
  },
  {
    type: 'confirm',
    name: 'breaking',
    message: 'Is this a breaking change?',
    default: false,
  },
];

const gitStatus = spawnSync('git', ['status', '-s']);
if (gitStatus.stdout.toString()) {
  prompts.unshift({
    type: 'confirm',
    name: 'stage',
    message:
      'It seems that you have changed some files after your last commit. Would you like to stage all changes now?',
    default: true,
  });
}

inquirer.prompt(prompts).then((answers) => {
  const strippedEmoji = emoji.strip(answers.emoji);
  const commitEmoji = emoji.unemojify(answers.emoji.split(strippedEmoji)[0]);

  if (answers.stage) {
    const output = spawnSync('git', ['add', '.']);
    console.log(output.stdout.toString());
  }

  const commandLineArgs = [];

  commandLineArgs.push('-m');
  commandLineArgs.push(`${commitEmoji} ${answers.title}`);

  if (answers.description) {
    commandLineArgs.push('-m');
    commandLineArgs.push(answers.description);
  }

  if (answers.breaking) {
    commandLineArgs.push('-m');
    commandLineArgs.push('"BREAKING CHANGE"');
  }

  spawn('git', ['commit', ...commandLineArgs], { stdio: 'inherit' });
});
