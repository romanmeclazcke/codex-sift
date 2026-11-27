export function parseRow(line) {
  const values = [];
  let index = 0;

  do {
    let value = "";
    if (line[index] === '"') {
      index++;
      let closed = false;
      while (index < line.length) {
        const character = line[index++];
        if (character !== '"') {
          value += character;
        } else if (line[index] === '"') {
          index++;
          value += '"';
        } else {
          closed = true;
          break;
        }
      }
      if (!closed || (index < line.length && line[index] !== ",")) {
        throw new SyntaxError("invalid quoted field");
      }
    } else {
      while (index < line.length && line[index] !== ",") {
        if (line[index] === '"') throw new SyntaxError("invalid quote");
        value += line[index++];
      }
    }
    values.push(value);
  } while (index++ < line.length);

  return values;
}
