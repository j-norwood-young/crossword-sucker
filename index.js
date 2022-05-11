const axios = require("axios");
const program = require("commander");
const fs = require("fs");
const path = require("path");

program.option("-u, --url <url>", "URL to send request to")
    .option("-i, --id <id>", "ID of the crossword")
    .option("-f, --file <file>", "File to read from")
    .option("-o, --output <output>", "Output file")
    .parse(process.argv);

async function main() {
    try {
        const options = program.opts();
        if (options.id) {
            options.url = `https://mycrosswordmaker.com/mobile-puzzle/${options.id}?iframe=1&amp;puzzle_id=${options.id}`;
        }
        let html;
        if (options.url) {
            const url = options.url;
            const id = url.match(/\/mobile-puzzle\/(\d+)/)[1];
            const fname = path.join("./cache", `${id}.html`);
            if (fs.existsSync(fname)) {
                html = fs.readFileSync(fname, "utf8");
            } else {
                const response = await axios.get(url);
                html = response.data;
                fs.writeFileSync(fname, html);
            }
        } else if (options.file) {
            html = fs.readFileSync(options.file, "utf8");
        }
        if (!html) throw "could not get data";
        const regex = /<script>(.|\n)*?<\/script>/g;
        const script = html.match(regex)[1];
        const jsons = script.match(/\{.*\}/g);
        const puzzle = JSON.parse(jsons[1]);
        // console.log(puzzle);
        const size = puzzle.dimension;
        const grid_object = JSON.parse(jsons[0]);
        const grid = new Array(size).fill(0).map(() => new Array(size).fill(0));
        for (let y = 1; y <= size; y++) {
            for (let x = 1; x <= size; x++) {
                grid[x-1][y-1] = grid_object[x + ""][y + ""];
            }
        }
        const across = [];
        const down = [];
        const questions_across = puzzle.clues.filter(clue => clue.across_binary);
        const questions_down = puzzle.clues.filter(clue => !clue.across_binary);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (isStartOfAcross(grid, x, y)) {
                    const pos = (y * size) + (x);
                    const clue = questions_across.find(question => question.puzzle_position === pos);
                    const question_number = get_question_number(grid, x, y);
                    across.push(`A${question_number}. ${clue.clue_text} ~ ${getWord(grid, x, y, "across")}`);
                }
                if (isStartOfDown(grid, x, y)) {
                    const pos = (y * size) + (x);
                    const clue = questions_down.find(question => question.puzzle_position === pos);
                    const question_number = get_question_number(grid, x, y);
                    down.push(`D${question_number}. ${clue.clue_text} ~ ${getWord(grid, x, y, "down")}`);
                }
            }
        }
        const result = `Title: ${puzzle.title}
${(puzzle.author_name) ? `Author: ${puzzle.author_name}\n` : "" }Date: ${new Date(puzzle.created_on).toISOString().split('T')[0]}


${
    grid.map(row => row.map(cell => cell === empty_cell ? "#" : cell).join("")).join("\n")
}


${across.join("\n")}

${down.join("\n")}`;
        if (options.output) {
            fs.writeFileSync(options.output, result);
        } else {
            console.log(result);
        }
    } catch (err) {
        console.error(err);
    }
}

const empty_cell = false;

function isStartOfAcross(grid, x, y) {
    const size = grid.length;
    if (grid[y][x] === empty_cell) return false;
    if (x >= size) return false;
    let word = getWord(grid, x, y, "across");
    if (word.length <= 1) return false;
    return ((x === 0) || (grid[y][x - 1] == empty_cell));
}

function isStartOfDown(grid, x, y) {
    const size = grid.length;
    if (grid[y][x] === empty_cell) return false;
    if (y >= size) return false;
    let word = getWord(grid, x, y, "down");
    if (word.length <= 1) return false;
    return ((y === 0) || (grid[y - 1][x] == empty_cell));
}

function getStartOfWord(grid, x, y, direction) {
    if (direction === "across") {
        while(x > 0 && grid[y][x - 1] !== empty_cell) {
            x--;
        }
    } else {
        while(y > 0 && grid[y - 1][x] !== empty_cell) {
            y--;
        }
    }
    return { x, y };
}

function getEndOfWord(grid, x, y, direction) {
    const size = grid.length;
    if (direction === "across") {
        while(x < size - 1 && grid[y][x + 1] !== empty_cell) {
            x++;
        }
    } else {
        while(y < size - 1 && grid[y + 1][x] !== empty_cell) {
            y++;
        }
    }
    return { x, y };
}

function getWord(grid, x, y, direction) {
    let start = getStartOfWord(grid, x, y, direction);
    let end = getEndOfWord(grid, x, y, direction);
    let word = "";
    if (direction === "across") {
        for (let i = start.x; i <= end.x; i++) {
            word += grid[y][i] || " ";
        }
    } else {
        for (let i = start.y; i <= end.y; i++) {
            word += grid[i][x] || " ";
        }
    }
    return word;
}

function get_question_number(grid, x, y) {
    const size = grid.length;
    const number_grid = new Array(size).fill(0).map(() => new Array(size).fill(false));
    let num = 1;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (grid[y][x] === empty_cell) continue;
            let found = false;
            if (isStartOfAcross(grid, x, y)) {
                found = true;
            } 
            if (isStartOfDown(grid, x, y)) {
                found = true;
            } 
            if (!found) {
                number_grid[y][x] = null;
            } else {
                number_grid[y][x] = num++;
            }
        }
    }
    return number_grid[y][x];
}

main();