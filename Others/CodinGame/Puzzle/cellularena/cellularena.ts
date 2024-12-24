/**
 * Grow and multiply your organisms to end up larger than your opponent.
 *
 * Docs:
 *  - Pathfinding: https://www.redblobgames.com/pathfinding/a-star/introduction.html
 **/

var inputs: string[] = readline().split(" ");
const width: number = parseInt(inputs[0]); // columns in the game grid
const height: number = parseInt(inputs[1]); // rows in the game grid

/**
 * Game params
 */

enum Owner {
  NEITHER = -1,
  ME = 1,
  ENEMY = 0,
}

enum ProteinsType {
  A,
  B,
  C,
  D,
}

enum OrganType {
  WALL = "WALL",
  ROOT = "ROOT",
  BASIC = "BASIC",
  TENTACLE = "TENTACLE",
  HARVESTER = "HARVESTER",
  SPORER = "SPORER",
  A = "A",
  B = "B",
  C = "C",
  D = "D",
}

const ProteinsSources: Set<OrganType> = new Set([
  OrganType.A,
  OrganType.B,
  OrganType.C,
  OrganType.D,
]);

type Point = {
  x: number;
  y: number;
};

enum Dir {
  N = "N",
  S = "S",
  W = "W",
  E = "E",
  X = "X",
}

interface OrganSpecs {
  cost: { [key: string]: number };
  production?: { [key: string]: number };
}

const ORGAN_SPECS = {
  HARVESTER: {
    cost: {
      C: 1,
      D: 1,
    },
    production: 1,
  },
  BASIC: {
    cost: {
      A: 1,
    },
  },
} as const;

type Organ = {
  id: number;
  coord: Point;
  dir: Dir;
  owner: Owner;
  type: OrganType;
  parentId: number;
  rootId: number;
};

interface NodePath {
  point: Point;
  f: number; // total cost
  g: number; // cost from start
  h: number; // heuristic cost
  parent: NodePath | null;
}

interface NodeMap {
  [key: string]: NodePath;
}

/**
 * Game logic
 */

class Game {
  entityCount: number;
  entities: Organ[];

  constructor() {
    this.entityCount = 0;
    this.entities = [];
  }

  findEntityById(id: number): Organ | null {
    const result = this.entities.find((entity) => entity.id === id);
    if (!result) {
      console.error(`Entity not found with id ${id}`);
    }
    return result || null;
  }

  findEntityByCoord(coord: Point): Organ | null {
    const result = this.entities.find(
      (entity) => entity.coord.x === coord.x && entity.coord.y === coord.y
    );
    if (!result) {
      console.error(`Entity not found at ${coord.x},${coord.y}`);
    }
    return result || null;
  }

  updateEntities(entityInputs: Organ[]): void {
    this.entities = entityInputs;
  }
}

/**
 * Organism logic
 */

class Organism {
  proteins: { A: number; B: number; C: number; D: number };
  potentialGrowth: { BASIC: number; HARVESTER: number };
  organs: Organ[];
  reachedProteinsSources: Organ[];
  path: Point[];

  constructor() {
    this.proteins = { A: 10, B: 0, C: 1, D: 1 };
    this.potentialGrowth = { BASIC: 0, HARVESTER: 0 };
    this.organs = [];
    this.reachedProteinsSources = [];
  }

  updatePotentialGrowth(): void {
    this.potentialGrowth.BASIC = this.proteins.A / 1;
    this.potentialGrowth.HARVESTER = this.proteins.C / 1 + this.proteins.D / 1;
  }

  updateEntities(entityInputs: Organ[]): void {
    this.organs = entityInputs.filter((entity) => entity.owner === Owner.ME);
  }

  getDirection(start: Point, end: Point): Dir {
    if (start.x === end.x) {
      return start.y > end.y ? Dir.N : Dir.S;
    } else {
      return start.x > end.x ? Dir.W : Dir.E;
    }
  }

  private harvest() {
    // Recover final target
    const target = Cellularena.findEntityByCoord(
      this.path[this.path.length - 1]
    );
    // If target is a protein source, remove it from the path and add it to the proteinSources
    if (target && ProteinsSources.has(target.type)) {
      this.reachedProteinsSources.push(target);
      this.path.pop();
    }
  }

  /**
   * Grow an organism
   * With the appropriate type and direction depending on the target and proteins available
   *
   * @param id source
   * @param coord target coordinates
   * @returns
   */
  grow(id: number, coord: Point) {
    let growthType: OrganType = OrganType.BASIC;
    let direction: Dir = Dir.X;
    const nextTarget: Point | undefined = this.path.at(1);
    const nextTargetEntity = nextTarget
      ? Cellularena.findEntityByCoord(nextTarget)
      : undefined;

    // Find next target if it's a protein source
    if (
      this.path.length === 2 &&
      nextTargetEntity &&
      ProteinsSources.has(nextTargetEntity.type)
    ) {
      console.error("check harvest");
      direction = this.getDirection(coord, nextTargetEntity.coord);
      growthType = OrganType.HARVESTER;
      this.reachedProteinsSources.push(nextTargetEntity);
      this.path.pop();
    }

    // Check if we have enough proteins to grow
    if (this.potentialGrowth[growthType] > 0) {
      console.log(
        `GROW ${id} ${coord.x} ${coord.y} ${growthType} ${direction}`
      );
      this.path.shift();
    } else {
      console.log("WAIT");
    }
  }

  private potentialTargets(): Organ[] {
    return Cellularena.entities.filter(
      (entity) =>
        ProteinsSources.has(entity.type) &&
        !this.organs.some(
          (organ) =>
            organ.coord.x === entity.coord.x && organ.coord.y === entity.coord.y
        ) &&
        !this.reachedProteinsSources.some(
          (source) =>
            source.coord.x === entity.coord.x &&
            source.coord.y === entity.coord.y
        )
    );
  }

  private getObstacles(): Organ[] {
    return Cellularena.entities.filter(
      (entity) =>
        entity.type === OrganType.WALL ||
        this.reachedProteinsSources.some((source) => source.id === entity.id)
    );
  }

  closestTarget(): Organ | null {
    const myRoot = this.organs.find((organ) => organ.type === OrganType.ROOT);
    if (!myRoot) {
      console.error("No root found");
      return null;
    }

    let potentialTargets: Organ[] = this.potentialTargets();

    let closest: Organ | null = null;
    let minPathLength = Infinity;

    // Get all wall positions
    const walls = this.getObstacles().reduce(
      (acc, entity) => acc.add(`${entity.coord.x},${entity.coord.y}`),
      new Set<string>()
    );

    for (const target of potentialTargets) {
      // Use existing A* pathfinding to get path length
      const path = this.makePath(myRoot.coord, target);

      // Check if path is valid (not blocked by walls)
      const isValidPath = path.every(
        (point) => !walls.has(`${point.x},${point.y}`)
      );

      if (isValidPath && path.length < minPathLength) {
        minPathLength = path.length;
        closest = target;
        this.path = path;
      }
    }

    return closest;
  }

  private manhattan(a: Point, b: Point): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private getNeighbors(point: Point): Point[] {
    return [
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    ].filter((p) => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height);
  }

  private reconstructPath(node: NodePath): Point[] {
    let path: Point[] = [];
    let current: NodePath | null = node;

    while (current) {
      path.unshift(current.point);
      current = current.parent;
    }

    // Remove start node
    path.shift();
    // Remove this.organs node from the path
    path = path.filter(
      (point) =>
        !this.organs.some(
          (organ) => organ.coord.x === point.x && organ.coord.y === point.y
        )
    );

    return path;
  }

  makePath(input_Start: Point, closestTarget: Organ): Point[] {
    const start = input_Start;
    const goal = closestTarget.coord;

    const openSet: NodePath[] = [];
    const closedSet = new Set<string>();
    const nodeMap: NodeMap = {};

    // Initialize start node
    const startNode: NodePath = {
      point: start,
      f: 0,
      g: 0,
      h: this.manhattan(start, goal),
      parent: null,
    };

    openSet.push(startNode);
    nodeMap[`${start.x},${start.y}`] = startNode;

    while (openSet.length > 0) {
      // Get node with lowest f score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;

      // Check if we reached the goal
      if (current.point.x === goal.x && current.point.y === goal.y) {
        return this.reconstructPath(current);
      }

      closedSet.add(`${current.point.x},${current.point.y}`);

      // Check neighbors
      for (const neighbor of this.getNeighbors(current.point)) {
        const key = `${neighbor.x},${neighbor.y}`;

        if (closedSet.has(key)) continue;

        const g = current.g + 1;
        const h = this.manhattan(neighbor, goal);
        const f = g + h;

        if (!nodeMap[key] || g < nodeMap[key].g) {
          const node: NodePath = {
            point: neighbor,
            f,
            g,
            h,
            parent: current,
          };

          nodeMap[key] = node;

          if (
            !openSet.some(
              (n) => n.point.x === neighbor.x && n.point.y === neighbor.y
            )
          ) {
            openSet.push(node);
          }
        }
      }
    }

    // No path found, return direct path
    return [goal];
  }

  // TODO: Maybe change to neighbor organ around target instead of last organ
  getLastOrgan(): Organ | null {
    if (this.organs.length === 0) return null;

    const lastOrgan = this.organs[this.organs.length - 1];

    return lastOrgan;
  }

  targetSelection(ArenaOrgans: Organ[]): Point {
    if (!this.path || this.path.length === 0) {
      let closestTarget = this.closestTarget();
      console.error("🧫 Cellular target: " + JSON.stringify(closestTarget));
      if (!closestTarget) {
        console.error("No targets found");
        return { x: 0, y: 0 };
      }
      if (!this.path) {
        console.error("No path found");
        return { x: 0, y: 0 };
      }
      //   console.error(this.path);
    }
    let target: Point = this.path[0];
    return target;
  }
}

/**
 * Main
 * Game loop
 * */

let Cellularena = new Game();
let MyOrganism = new Organism();

// game loop
while (true) {
  // Update entity count
  const entityCount: number = parseInt(readline());
  Cellularena.entityCount = entityCount;

  // Parse entities
  const entities: Organ[] = [];
  const myOrgaEntities: Organ[] = [];
  for (let i = 0; i < entityCount; i++) {
    const inputs = readline().split(" ");
    const entityType = inputs[2] as OrganType;

    let entity: Organ = {
      coord: { x: parseInt(inputs[0]), y: parseInt(inputs[1]) } as Point,
      type: entityType,
      owner: parseInt(inputs[3]) as Owner,
      id: parseInt(inputs[4]),
      dir: inputs[5] as Dir,
      parentId: parseInt(inputs[6]),
      rootId: parseInt(inputs[7]),
    };
    entities.push(entity);
    myOrgaEntities.push(entity);
  }
  Cellularena.updateEntities(entities);
  MyOrganism.updateEntities(entities);

  const inputs1: string[] = readline().split(" ");
  MyOrganism.proteins = {
    A: parseInt(inputs1[0]),
    B: parseInt(inputs1[1]),
    C: parseInt(inputs1[2]),
    D: parseInt(inputs1[3]),
  };
  MyOrganism.updatePotentialGrowth();

  var inputs: string[] = readline().split(" ");
  const oppA: number = parseInt(inputs[0]);
  const oppB: number = parseInt(inputs[1]);
  const oppC: number = parseInt(inputs[2]);
  const oppD: number = parseInt(inputs[3]); // opponent's protein stock

  // TODO: Implement harvesting logic

  const target: Point = MyOrganism.targetSelection(Cellularena.entities);
  const lastOrgan = MyOrganism.getLastOrgan()!;

  console.error("Target:" + JSON.stringify(target));
  console.error("Path:" + JSON.stringify(MyOrganism.path));
  const requiredActionsCount: number = parseInt(readline()); // your number of organisms, output an action for each one in any order
  for (let i = 0; i < requiredActionsCount; i++) {
    // console.log("WAIT");
    MyOrganism.grow(lastOrgan.id, target);
  }

  // Provide debug information
  console.error("Path:" + JSON.stringify(MyOrganism.path));
}