const patternBuilder = require("./pattern-builder");

test("Init creates a valid object", () => {
  const value = patternBuilder.init("a", "b");
  expect(value).toHaveProperty("source", ["a"]);
  expect(value).toHaveProperty("detail-type", ["b"]);
  expect(Object.keys(value).length).toBe(2);
});

test("buildSegment generates valid pattern", () => {
  const objectArray = ["a", "b", "c"];
  const answer = { c: ["d"] };
  
  const segment = patternBuilder.buildSegment(answer, objectArray);
  console.log(segment);
  expect(segment.a.b.c).toContain("d");
});