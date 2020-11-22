const schemaBrowser = require("./schema-browser");

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
  schemaBrowser.deepMerge(merged, obj1, obj2);
  console.log(merged);
  expect(Object.keys(merged).length).toBe(2);
  expect(Object.keys(merged.a.b).length).toBe(2);
  expect(merged.a.b.c.value).toBe(1);
  expect(merged.a.b.d.value).toBe(2);
  expect(merged.e.value).toBe(3);
});


