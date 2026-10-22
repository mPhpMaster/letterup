import * as animal from "./animal";
import * as plant from "./plant";
import * as color from "./color";
import * as sport from "./sport";
import * as job from "./job";
import * as country from "./country";
import * as food from "./food";
import * as object from "./object";
import * as human from "./human";
import * as brand from "./brand";

export const WORDLISTS = { animal, plant, color, sport, job, country, food, object, human, brand } as const;
export type WordlistCategory = keyof typeof WORDLISTS;
