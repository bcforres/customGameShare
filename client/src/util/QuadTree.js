/**
 * QuadTree.js
 *
 * Quad tree data structure for storing units on the map.
 *
 * This is essential for efficient collision detection
 *
 */

/**
 * QuadTree datastructure
 *
 * @constructor
 * @param {Rect} bounds bounding box of the region
 */
function QuadTree(bounds, parent, root) {
  'use strict';
  this.MIN_SIZE = 10; // Minimum edge length of bounding box
  this.MAX_ELEMS = 4; // Limit to 4 nodes max
  this.MAX_CHILDREN = 4; // it is a quad tree...

  this.bounds = bounds;
  this.parent = parent;
  if (!root) {
    this.root = this;
  } else {
    this.root = root;
  }

  // If the quadtree has children, then only elements which do not fit inside
  // any child will be here
  this.elems = []; // Array of elements, must have a pos attribute with x, y

  this.children = []; // chidren nodes NW, NE, SW, SE
}

/**
 * Divides quad tree.
 * Note should not be called on a quad tree with width < MIN_SIZE
 */
QuadTree.prototype.subDivide = function () {
  'use strict';
  var i, j, x, y, width, height, curPos, curDim, bound, halfHeight, halfWidth
    , newElems, elem;

  curPos = this.bounds.getPos();
  curDim = this.bounds.getDim();
  halfHeight = Math.floor(curDim.height / 2);
  halfWidth = Math.floor(curDim.width / 2);

  for (i = 0; i < this.MAX_CHILDREN; i += 1) {
    if (i % 2 === 0) {
      x = curPos.x;
      width = halfWidth;
    } else {
      x = curPos.x + halfWidth + 1;
      width = curDim.width - halfWidth;
    }

    if (i < 2) {
      y = curPos.y;
      height = halfHeight;
    } else {
      y = curPos.y + halfHeight + 1;
      height = curDim.height - halfHeight;
    }
    bound = new Rect();
    bound.setPos(x, y);
    bound.setDim(width, height);

    this.children.push(new QuadTree(bound, this, this.root));
  }

  newElems = [];

  for (i = 0; i < this.elems.length; i += 1) {
    elem = this.elems[i];
    for (j = 0; j < this.children.length; j += 1) {
      if (this.children[j].insert(elem)) {
        break;
      }
    }

    if (j === this.children.length) {
      newElems.push(elem);
    }
  }

  this.elems = newElems;
};

/**
 * Finds a suitable node for the element, return null if none exist
 */
QuadTree.prototype.findNode = function (elem) {
  'use strict';
  var i;

  if (!this.bounds.circleContained(elem.pos, elem.getRadius())) {
    return null;
  }

  /*
  for (i = 0; i < this.elems.length; i += 1) {
    console.log(Util.distance2d(this.elems[i].pos, elem.pos));
    if (
      this.elems[i] !== elem &&
        (Util.distance2d(this.elems[i].pos, elem.pos) <
         this.elems[i].getRadius() + elem.getRadius())
    ) {
      console.log('collision');
      return null;
    }
  }
  */

  for (i = 0; i < this.children.length; i += 1) {
    if (this.children[i].findNode(elem)) {
      return this.children[i];
    }
  }

  return this;
};

/**
 * Insert an element into the quadtree
 *
 * @param {MapEntity} elem Any element with a pos attribute with x, y
 * @return {boolean} Returns true when successfully added, false otherwise
 */
QuadTree.prototype.insert = function (elem) {
  'use strict';
  var child, i;

  if (!this.bounds.circleContained(elem.pos, elem.getRadius())) {
    return false;
  }

  if (this.elems.length < this.MAX_ELEMS || this.bounds.width < this.MIN_SIZE) {
    this.elems.push(elem);
    elem.setQTree(this);
    return true;
  } else if (this.children.length === 0) {
    this.subDivide();
  }

  for (i = 0; i < this.children.length; i += 1) {
    child = this.children[i];
    if (child.insert(elem)) {
      return true;
    }
  }

  // Doesn't fit in children, probably between children
  this.elems.push(elem);
  elem.setQTree(this);
  return true;
};

/**
 * Remove an element from the quadtree
 *
 * @param {MapEntity} elem Element with pos containing x, y
 * @param {boolean} isHere The element is here (moved) avoid checking for fit
 * @return {boolean} returns true if successfully removed element
 */
QuadTree.prototype.remove = function (elem, isHere) {
  'use strict';
  var i, entity, child;

  // Check center first because it's faster
  if (!isHere && (!this.bounds.pointIn(elem.pos) ||
      !this.bounds.circleContained(elem.pos, elem.getRadius()))) {
    return false;
  }

  for (i = 0; i < this.elems.length; i += 1) {
    entity = this.elems[i];
    if (entity === elem) {
      break;
    }
  }

  if (i !== this.elems.length) {
    this.elems.splice(i, 1); // Remove the element
    return true;
  }

  for (i = 0; i < this.children.length; i += 1) {
    if (this.children[i].remove(elem)) {
      return true;
    }
  }

  return false;
};

/**
 * Searches a qTree items in range of elem. Searches up the parent chain
 *
 * @param {MapEntity} elem Element to check for collisons
 * @param {boolean} collision if true, returns first found collision
 */

QuadTree.prototype.getElemsCircleRangeParents = function (elem, collision) {
  'use strict';
  var i, results;

  results = [];

  for (i = 0; i < this.elems.length; i += 1) {
    if (
      this.elems[i] !== elem &&
      (Util.distance2d(elem.pos, this.elems[i].pos) <
        elem.getRadius() + this.elems[i].getRadius())
    ) {
      //console.log('result!');
      results.push(this.elems[i]);
      if (collision) {
        return results;
      }
    }
  }

  if (!this.parent) {
    return results;
  }

  // TODO: make this tail recursive if performance problems
  return results.concat(
    this.parent.getElemsCircleRangeParents(elem, collision));
};


/**
 * Get elements in a circle around given point
 *
 * Should be called on root to get all elements in circle range,
 *
 * @param {MapEntity} elem Element to check if for range
 * @param {boolean} collision if true, returns first found collision
 * @param {QuadTree} qTree the parent quad tree of the element
 * @return {Array} returns an array of elements in range
 *
 */
QuadTree.prototype.getElemsCircleRange = function (elem, collision, qTree) {
  'use strict';
  var i, entity, result;
  result = [];

  if (!this.bounds.circleIntersect(elem.getPos(), elem.getRadius)) {
    return result;
  }

  // First check elems inside the array
  for (i = 0; i < this.elems.length; i += 1) {
    entity = this.elems[i];
    if (entity === elem) {
      continue;
    }

    // Intersection
    if (
      Util.distance2d(elem.getPos(), entity.getPos()) <=
        elem.getRadius() + entity.getRadius()
    ) {
      //console.log(Util.distance2d(elem.getPos(), entity.getPos()));
      result.push(entity);

      // If only checking for collision then, stop
      if (collision) {
        return result;
      }
    }
  }
  // Check all the children too
  for (i = 0; i < this.children.length; i += 1) {
    result = result.concat(
      this.children[i].getElemsCircleRange(elem, collision));
  }

  return result;
};

/**
 * Get all elements using the selection rectangle
 *
 * This method has some special rules, so its not the same as
 * getElemsRectIntersect
 */
QuadTree.prototype.getElemsSelect = function (rect) {
  'use strict';
  var result, i, topPos, elem;
  result = [];

  if (!this.bounds.rectIntersect(rect)) {
    return result;
  }

  for (i = 0; i < this.elems.length; i += 1) {
    elem = this.elems[i];
    topPos = new THREE.Vector2(
      elem.getPos().x
    , elem.getPos().y + elem.getRadius() / 2
    );
    if (rect.circleIntersect(elem.getPos(), elem.getRadius()) ||
       rect.circleIntersect(topPos, elem.getRadius())) {
      result.push(this.elems[i]);
    }
  }

  for (i = 0; i < this.children.length; i += 1) {
    result = result.concat(this.children[i].getElemsSelect(rect));
  }

  return result;
};

/**
 * Runs given function on all elements
 *
 * @param {Function} func function to run on each element
 */
QuadTree.prototype.forEach = function (func) {
  'use strict';
  var i;

  for (i = 0; i < this.elems.length; i += 1) {
    func(this.elems[i], this);
  }

  for (i = 0; i < this.children.length; i += 1) {
    this.children[i].forEach(func);
  }
};

/**
 * Updates an element's location in the qTree
 *
 * @param {MapEntity} elem The map entity location of
 * @return {boolean} Returns true if the update is successful
 */
QuadTree.prototype.update = function (elem) {
  'use strict';
  var oldNode, newNode;
  oldNode = elem.getQTree();

  // Don't want to have to start at root, but have to do it because of varying
  // sized entities
  newNode = this.root.findNode(elem);

  // Collision in new node
  if (
    newNode === null ||
      this.root.getElemsCircleRange(elem, true).length > 0
  ) {
    return false;
  }

  elem.setQTree(newNode);

  if (newNode !== oldNode) {
    oldNode.remove(elem, true);
    newNode.insert(elem);
    console.log(this.root.size());
  }

  return true;
};

QuadTree.prototype.size = function () {
  'use strict';
  var i, size;
  size = this.elems.length;

  for (i = 0; i < this.children.length; i += 1) {
    size += this.children[i].size();
  }

  return size;
};

/**
 * @param {Vector} pos Postion vector with x, y coords
 * @return {MapEntity} Returns the map entity at given location
 */
QuadTree.prototype.getLocEntity = function (pos) {
  'use strict';
  var i, result;

  if (!this.bounds.pointIn(pos)) {
    return null;
  }

  for (i = 0; i < this.elems.length; i += 1) {
    if (
      Util.distance2d(pos, this.elems[i].getPos()) < this.elems[i].getRadius()
    ) {
      return this.elems[i];
    }
  }

  for (i = 0; i < this.children.length; i += 1) {
    result = this.children[i].getLocEntity(pos);
    if (result) {
      return result;
    }
  }

  return null;
};
