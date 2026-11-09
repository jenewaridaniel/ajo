// Bitmaps for <Pixels>. One character per pixel; see the palette in pixel.tsx.

/** The mark: a ring of members around a coin. */
export const LOGO = [
  "...lll...",
  ".ll...ll.",
  ".l.....l.",
  "l...y...l",
  "l..yyy..l",
  "l...y...l",
  ".l.....l.",
  ".ll...ll.",
  "...lll...",
];

/** The pot: a clay pot with a violet band, coins dropping in. */
export const POT = [
  "..........kkkk..............",
  ".........kyyyyk.....kkkk....",
  ".........kywyyk....kyyyyk...",
  ".........kyyyyk....kywyyk...",
  "..........kkkk.....kyyyyk...",
  "....................kkkk....",
  "..............kkkk..........",
  ".............kyyyyk.........",
  "......kkkkkkkkywyykkkkkkk...",
  ".....kllllllllkkkkllllllk...",
  ".....kkkkkkkkkkkkkkkkkkkk...",
  "......kllllllllllllllllk....",
  ".....klllllllllllllllllllk..",
  "....kllwwllllllllllllllldk..",
  "...kllwwlllllllllllllllllddk",
  "...kvvvvvvvvvvvvvvvvvvvvvvvk",
  "...kvvwvvvvwvvvvwvvvvwvvvvvk",
  "...kvvvvvvvvvvvvvvvvvvvvvvvk",
  "...klllllllllllllllllllllddk",
  "...kllllllllllllllllllllldk.",
  "....klllllllllllllllllllddk.",
  ".....klllllllllllllllllddk..",
  "......kddllllllllllllddk....",
  ".......kkddddddddddddkk.....",
  ".........kkkkkkkkkkkk.......",
];

/** Robin, the guide: a violet squid, fins up as if waving. */
export const ROBIN = [
  "............kk............",
  "...........kvvk...........",
  "..........kvpvvk..........",
  ".........kvppvvvk.........",
  "..kkk...kvppvvvvvk...kkk..",
  "..kvvkk.kvpvvvvvvk.kkvvk..",
  "..kvvvvkkvvvvvvvvkkvvvvk..",
  "...kvvvvvvvvvvvvvvvvvvk...",
  "....kkkvvvvvvvvvvvvkkk....",
  "......kvvvvvvvvvvvvk......",
  ".....kvvvvvvvvvvvvvvk.....",
  ".....kvwwwwvvvvwwwwvk.....",
  ".....kwwwkkwvvwwwkkwk.....",
  ".....kwwwkkwvvwwwkkwk.....",
  ".....kwwwwwwvvwwwwwwk.....",
  ".....kvwwwwvvvvwwwwvk.....",
  ".....kvyyvkvvvvkvyyvk.....",
  ".....kvvvvvkkkkvvvvvk.....",
  "....kvvvvvvvvvvvvvvvvk....",
  "...kvvkvvkvvvvvvkvvkvvk...",
  "..kvvkkvvkkvvvvkkvvkkvvk..",
  "..kvk.kvvk.kvvk.kvvk.kvk..",
  ".kvvk.kvk..kvvk..kvk.kvvk.",
  ".kvk..kvk..kvk...kvk..kvk.",
  "kvvk.kvvk..kvk...kvvk.kvvk",
  "kvk..kvk..kvvk....kvk..kvk",
  "kk...kvk..kvk.....kvk...kk",
  ".....kk...kk.......kk.....",
];

/**
 * The scattered-pixel ground from the reference, the same on every load:
 * dense at the bottom, thinning out towards the top.
 */
export function dissolveRows(width: number, height: number): string[] {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    const density = Math.pow(y / (height - 1), 1.6);
    let row = "";
    for (let x = 0; x < width; x++) {
      const r = rand();
      row += r < density * 0.9 ? (r < density * 0.25 ? "d" : "l") : r > 0.985 ? "l" : ".";
    }
    rows.push(row);
  }
  return rows;
}
