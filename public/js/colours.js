
const colours = [
  `--mid-green`,
  `--bad-pink`,
  `--desat-pink`,
  `--grey-teal`,
  `--yelly`,
  `--too-red`,
];
const c = colours[Math.floor(Math.random() * colours.length)];
document.body.setAttribute('style', `--highlight: var(${c});`);
