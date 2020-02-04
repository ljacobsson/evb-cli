const patternBuilder = require("./pattern-builder");

test("Init is creates a valid object", () => {
  const value = patternBuilder.init("a", "b");
  expect(value).toHaveProperty("source", ["a"]);
  expect(value).toHaveProperty("detail-type", ["b"]);
  expect(Object.keys(value).length).toBe(2);
});

test("Deepmerge 2 objects", () => {
  const obj1 = {
    a: {
      b: {
        c: {
          value: 1
        }
      }
    }
  };
  const obj2 = {
    a: {
      b: {
        d: {
          value: 2
        }
      }
    },
    e: {
      value: 3
    }
  };

  let merged = {};
  patternBuilder.deepMerge(merged, obj1, obj2);
  console.log(merged);
  expect(Object.keys(merged).length).toBe(2);
  expect(Object.keys(merged.a.b).length).toBe(2);
  expect(merged.a.b.c.value).toBe(1);
  expect(merged.a.b.d.value).toBe(2);
  expect(merged.e.value).toBe(3);
});

test("buildSegment generates valid pattern", () => {
  const objectArray = ["a", "b", "c"];
  const answer = { c: ["d"] };
  
  const segment = patternBuilder.buildSegment(answer, objectArray);
  console.log(segment);
  expect(segment.a.b.c).toContain("d");
});
