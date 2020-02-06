"use strict";

const tagPrimitive = (span, key, value) => {
  span.setTag(key, value);
};

const tagObject = (span, obj) => {
  for (let key in obj) {
    if (!obj[key]) continue;
    if (isArray(obj[key])) {
      tagArray(span, obj, key);
      continue;
    }
    if (isPrimitive(obj[key])) {
      tagPrimitive(span, key, obj[key]);
      continue;
    }
    tagObject(span, obj[key]);
  }
};

const tagArray = (span, arr, key) => {
  for (let index = 0; index < arr.length; index++) {
    const item = arr[index];
    if (isPrimitive(item)) {
      tagPrimitive(span, `${key}${index}`, item);
      continue;
    }
    tagObject(span, item);
  }
};

const isPrimitive = input => {
  return input !== Object(input);
};

const isArray = input => {
  return Array.isArray(input);
};

module.exports = {
  tagObject
};
