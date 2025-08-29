// rt2json.ts  (run: npm i peggy && ts-node rt2json.ts path/to/file.rt > out.json)
import fs from "fs"; import peggy from "peggy";

const grammar = `
{
  function obj(pairs){
    const o = {};
    for (const [k,v] of pairs){
      if (Object.prototype.hasOwnProperty.call(o, k)){
        const prev = o[k];
        if (Array.isArray(prev)) o[k] = prev.concat([v]);
        else o[k] = [prev, v];
      } else {
        o[k] = v;
      }
    }
    return o;
  }
}
Start = _ v:Top _ { return v; }

Top
  = Object
  / ps:Pairs { return obj(ps); }
  / Array
  / Value

Pairs
  = head:Pair tail:(_ Pair)* { return [head, ...tail.map(t=>t[1])]; }

Object
  = "{" _ ps:Pairs? _ "}" { return ps ? obj(ps) : {}; }

Pair
  = k:Key _ "=" _ v:Top { return [k, v]; }
  / k:Key _ v:Object    { return [k, v]; }
  / k:Key _ v:Array     { return [k, v]; }
  / k:Key _ v:Primitive { return [k, v]; }
  / k:Key               { return [k, true]; }

Primitive
  = String
  / Number
  / Boolean

Key
  = Identifier / String

Value
  = Primitive

Array
  = "[" _ elems:(Top (_ "," _ Top)*)? _ ","? _ "]"
    { return elems ? [elems[0], ...elems[1].map(e=>e[3])] : []; }

Identifier = $([A-Za-z_][A-Za-z0-9_\\-\\.]*)
String
  = "\\"" chars:($([^"\\\\] / "\\\\" .))* "\\"" { return chars.join(""); }

Number
  = n:$("-"? [0-9]+ ("." [0-9]+)? ([eE] [+-]? [0-9]+)?) { return parseFloat(n); }

Boolean = "true" { return true; } / "false" { return false; }

_ = (WS / Comment)*
WS = [ \\t\\n\\r]+
Comment = "//" [^\\n]* ("\\n" / !.) / "/*" (!"*/" .)* "*/"
`;

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath) {
  console.error("Usage: ts-node rt2json.ts <input.rt> [output.json]");
  process.exit(2);
}
const src = fs.readFileSync(inPath, "utf8");
const parser = peggy.generate(grammar);
let data: any;
try {
  data = parser.parse(src);
} catch (e: any) {
  console.error("Parse error:", e?.message || e);
  if (e?.location?.start) {
    console.error(`At ${e.location.start.line}:${e.location.start.column}`);
  }
  process.exit(1);
}
const json = JSON.stringify(data, null, 2);
if (outPath) {
  fs.writeFileSync(outPath, json);
} else {
  console.log(json);
}
