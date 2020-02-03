function init(source, detailType) {
    return { source: [source], "detail-type": [detailType] };
}

function isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
  }
  
  function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
  
    if (isObject(target) && isObject(source)) {
      for (const key in source) {
        if (isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
  
    return deepMerge(target, ...sources);
  }
  

  function getPatternSegment(answer, objectArray) {
    let x = {};
    let current = answer;
    for (let i = objectArray.length - 2; i >= 0; i--) {
      const newObj = {};
      newObj[objectArray[i]] = current;
      x[objectArray[i]] = newObj;
      current = x[objectArray[i]];
    }
    return current;
  }

module.exports = {
    init,
    deepMerge,
    getPatternSegment
}