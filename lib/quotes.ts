// Shared quote model + built-in defaults.
// Live data lives in Redis ("quotes:list"), seeded from DEFAULT_QUOTES on
// first dashboard load. The wallpaper route falls back to DEFAULT_QUOTES if
// Redis has never been seeded.

export interface Quote {
  id: string;
  q: string;        // quote text
  c: string;        // character / person (uppercase)
  s: string;        // show / source
  disabled?: boolean;
  custom?: boolean; // added via dashboard (deletable)
}

export const QUOTES_KEY  = "quotes:list";
export const PIN_KEY     = "quotes:pin";      // { id } — shown until unpinned
export const PORTRAIT_KEY = (slug: string) => `portrait:${slug}`;

// Character name -> portrait slug ("FRANK UNDERWOOD" -> "frank-underwood")
export function slugify(c: string): string {
  return c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const D = (id: string, q: string, c: string, s: string) => ({ id, q, c, s });

export const DEFAULT_QUOTES: Quote[] = [
  D("d01", "The road to power is paved with hypocrisy, and casualties.", "FRANK UNDERWOOD", "House of Cards"),
  D("d02", "For those of us climbing to the top of the food chain, there can be no mercy. There is but one rule: hunt or be hunted.", "FRANK UNDERWOOD", "House of Cards"),
  D("d03", "You are entitled to nothing.", "FRANK UNDERWOOD", "House of Cards"),
  D("d04", "Proximity to power deludes some into thinking they wield it.", "FRANK UNDERWOOD", "House of Cards"),
  D("d05", "I've always loathed the necessity of sleep. Like death, it puts even the most powerful men on their backs.", "FRANK UNDERWOOD", "House of Cards"),
  D("d06", "When you're backed against the wall, break the goddamn thing down.", "HARVEY SPECTER", "Suits"),
  D("d07", "I don't get lucky. I make my own luck.", "HARVEY SPECTER", "Suits"),
  D("d08", "Anyone can do my job, but no one can be me.", "HARVEY SPECTER", "Suits"),
  D("d09", "Win a no-win situation by rewriting the rules.", "HARVEY SPECTER", "Suits"),
  D("d10", "Don't raise your voice. Improve your argument.", "HARVEY SPECTER", "Suits"),
  D("d11", "I am the one who knocks.", "WALTER WHITE", "Breaking Bad"),
  D("d12", "I'm not in the meth business. I'm in the empire business.", "WALTER WHITE", "Breaking Bad"),
  D("d13", "No more half measures.", "MIKE EHRMANTRAUT", "Breaking Bad"),
  D("d14", "I did it for me. I liked it. I was good at it. And I was really alive.", "WALTER WHITE", "Breaking Bad"),
  D("d15", "By order of the Peaky Blinders.", "TOMMY SHELBY", "Peaky Blinders"),
  D("d16", "I don't pay for suits. My suits are on the house, or the house burns down.", "TOMMY SHELBY", "Peaky Blinders"),
  D("d17", "There's no rest for those who want to live by their own rules.", "TOMMY SHELBY", "Peaky Blinders"),
  D("d18", "Never forget what you are. The rest of the world will not. Wear it like armor, and it can never be used to hurt you.", "TYRION LANNISTER", "Game of Thrones"),
  D("d19", "A mind needs books as a sword needs a whetstone, if it is to keep its edge.", "TYRION LANNISTER", "Game of Thrones"),
  D("d20", "When you play the game of thrones, you win or you die.", "CERSEI LANNISTER", "Game of Thrones"),
  D("d21", "Make it simple, but significant.", "DON DRAPER", "Mad Men"),
  D("d22", "People tell you who they are, but we ignore it because we want them to be who we want them to be.", "DON DRAPER", "Mad Men"),
  D("d23", "You are not serious people.", "LOGAN ROY", "Succession"),
  D("d24", "I love you, but you are not serious people.", "LOGAN ROY", "Succession"),
  D("d25", "What's the point of having 'fuck you money' if you never say 'fuck you'?", "BOBBY AXELROD", "Billions"),
  D("d26", "The key to having everything is making sure you don't let anyone take it from you.", "BOBBY AXELROD", "Billions"),
  D("d27", "A man's gotta have a code.", "OMAR LITTLE", "The Wire"),
  D("d28", "All in the game, yo. All in the game.", "OMAR LITTLE", "The Wire"),
  D("d29", "I'm gonna make him an offer he can't refuse.", "DON CORLEONE", "The Godfather"),
  D("d30", "Keep your friends close, but your enemies closer.", "MICHAEL CORLEONE", "The Godfather"),
  D("d31", "You see, in this world there's two kinds of people, my friend: those with loaded guns and those who dig. You dig.", "BLONDIE", "The Good, the Bad and the Ugly"),
  D("d32", "You either die a hero or live long enough to see yourself become the villain.", "HARVEY DENT", "The Dark Knight"),
  D("d33", "The devil doesn't come dressed in a red cape and pointy horns. He comes as everything you've ever wished for.", "TUCKER MAX", "Tucker Max"),
  D("d34", "Money is a scoreboard where you can rank how you're doing against other people.", "MARK CUBAN", "Mark Cuban"),
  D("d35", "People don't want the truth because they don't want their illusions destroyed.", "FRIEDRICH NIETZSCHE", "Nietzsche"),
  D("d36", "Nearly all men can stand adversity, but if you want to test a man's character, give him power.", "ABRAHAM LINCOLN", "Abraham Lincoln"),
  D("d37", "The man who reads nothing at all is better educated than the man who reads nothing but newspapers.", "THOMAS JEFFERSON", "Thomas Jefferson"),
  D("d38", "A cynic is a man who knows the price of everything and the value of nothing.", "OSCAR WILDE", "Oscar Wilde"),
  D("d39", "Man is least himself when he talks in his own person. Give him a mask, and he will tell you the truth.", "OSCAR WILDE", "Oscar Wilde"),
  D("d40", "The stupid neither forgive nor forget; the naive forgive and forget; the wise forgive but do not forget.", "THOMAS SZASZ", "Thomas Szasz"),
];
