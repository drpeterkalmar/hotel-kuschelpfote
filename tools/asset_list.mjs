// Welche Kenney-Teile in welches Bündel kommen (Quellen siehe assets/LICENSES.md, alle CC0).
// parts: [{src, kit?, at:[x,y,z], rotY, scale, onTop}] – onTop setzt das Teil auf die Oberkante des vorigen.
const GREY = { rock: [0.55, 0.56, 0.6], rockDark: [0.38, 0.39, 0.43], rockTrack: [0.66, 0.67, 0.7] };
export const PETS = ['bunny', 'chick', 'cow', 'pig', 'bee', 'panda', 'cat', 'dog', 'penguin',
  'beaver', 'caterpillar', 'crab', 'deer', 'elephant', 'fish', 'fox', 'giraffe', 'hog', 'koala', 'lion', 'monkey', 'parrot', 'polar', 'tiger'];

const F = (src, extra = {}) => ({ src, ...extra });
export const BUNDLES = {
  moebel: {
    kit: 'furn',
    items: {
      bedSingle: F('bedSingle'), bedDouble: F('bedDouble'), bedBunk: F('bedBunk'), cabinetBed: F('cabinetBedDrawerTable'),
      loungeSofa: F('loungeSofa'), loungeChair: F('loungeChair'), loungeChairRelax: F('loungeChairRelax'), loungeDesignSofa: F('loungeDesignSofa'),
      chairCushion: F('chairCushion'), benchCushion: F('benchCushion'), stoolBar: F('stoolBar'),
      tableRound: F('tableRound'), tableCoffee: F('tableCoffee'), table: F('table'), sideTable: F('sideTable'),
      bathtub: F('bathtub'), shower: F('showerRound'), bathroomSink: F('bathroomSink'), toilet: F('toilet'), bathroomCabinet: F('bathroomCabinet'),
      pottedPlant: F('pottedPlant'), plantSmall: F('plantSmall2'),
      rugRound: F('rugRound'), rugRectangle: F('rugRectangle'), rugRounded: F('rugRounded'), rugSquare: F('rugSquare'),
      lampRoundFloor: F('lampRoundFloor'), lampSquareFloor: F('lampSquareFloor'),
      bookcaseOpen: F('bookcaseOpen'), bear: F('bear'), radio: F('radio'), speaker: F('speaker'),
      tv: { parts: [{ src: 'cabinetTelevision' }, { src: 'televisionModern', onTop: true }] },
      kitchenFridge: F('kitchenFridge'), kitchenStove: F('kitchenStove'), kitchenCabinet: F('kitchenCabinet'),
      kitchenBar: F('kitchenBar'), coffeeBar: { parts: [{ src: 'kitchenBar' }, { src: 'kitchenCoffeeMachine', onTop: true }] },
      toyBox: F('cardboardBoxOpen'), coatRack: F('coatRackStanding'), washer: F('washer'),
      // Restaurant-Teile mit Essen aus dem Food Kit
      cakeTable: { parts: [{ src: 'tableRound' }, { src: 'cake-birthday', kit: 'food', onTop: true, scale: 0.27 }] },
      fruitBuffet: { parts: [{ src: 'kitchenBar' }, { src: 'watermelon', kit: 'food', onTop: true, at: [-0.18, 0, 0], scale: 0.21 },
        { src: 'apple', kit: 'food', onTop: true, at: [0.12, 0, 0.05], scale: 0.27 }, { src: 'banana', kit: 'food', onTop: true, at: [0.25, 0, -0.05], scale: 0.27 }] },
      carrotTable: { parts: [{ src: 'tableCoffee' }, { src: 'carrot', kit: 'food', onTop: true, at: [-0.15, 0, 0], rotY: 0.5 , scale: 0.3 }, { src: 'carrot', kit: 'food', onTop: true, at: [0.1, 0, 0.05], rotY: 2 , scale: 0.3 }, { src: 'carrot', kit: 'food', onTop: true, at: [0.25, 0, -0.08], rotY: 1.2 , scale: 0.3 }] },
      sundaeTable: { parts: [{ src: 'tableRound' }, { src: 'sundae', kit: 'food', onTop: true, at: [-0.1, 0, 0] , scale: 0.3 }, { src: 'cupcake', kit: 'food', onTop: true, at: [0.15, 0, 0.05] , scale: 0.3 }] },
      fishTable: { parts: [{ src: 'table' }, { src: 'fish', kit: 'food', onTop: true, at: [-0.15, 0, 0] , scale: 0.3 }, { src: 'fish', kit: 'food', onTop: true, at: [0.18, 0, 0.05], rotY: 0.6 , scale: 0.3 }] },
      bambooPot: { parts: [{ src: 'pot_large', kit: 'nature' }, { src: 'crops_bambooStageB', kit: 'nature', onTop: true, at: [0, -0.15, 0] }] },
      flowerPot: { parts: [{ src: 'pot_small', kit: 'nature' }, { src: 'flower_redA', kit: 'nature', onTop: true, at: [0, -0.12, 0], scale: 0.9 }] },
      flowerPotY: { parts: [{ src: 'pot_small', kit: 'nature' }, { src: 'flower_yellowB', kit: 'nature', onTop: true, at: [0, -0.12, 0], scale: 0.9 }] },
      honeyTable: { parts: [{ src: 'sideTable' }, { src: 'honey', kit: 'food', onTop: true , scale: 0.3 }] },
      // Mond-Möbel (Space Kit + umgefärbte Möbel)
      capsuleBed: F('bedSingle', { recolor: { wood: [0.86, 0.88, 0.93], metal: [1, 0.63, 0.2] } }),
      spaceDesk: { parts: [{ src: 'desk_computer', kit: 'space' }] },
      spaceChair: { parts: [{ src: 'desk_chair', kit: 'space' }] },
      crystalLamp: { parts: [{ src: 'rock_crystals', kit: 'space', recolor: GREY, scale: 0.45 }] },
      telescope: { parts: [{ src: 'satelliteDish', kit: 'space', scale: 0.6 }] },
      moonRock: { parts: [{ src: 'rock_crystalsLargeA', kit: 'space', recolor: GREY, scale: 0.45 }] },
      rocketToy: { parts: [{ src: 'rocket_finsA', kit: 'space', scale: 0.22 }, { src: 'rocket_fuelA', kit: 'space', stack: true, scale: 0.22 }, { src: 'rocket_topA', kit: 'space', stack: true, scale: 0.22 }] },
      spaceSofa: F('loungeDesignSofa', { recolor: { wood: [0.86, 0.88, 0.93] } }),
      astroStatue: { parts: [{ src: 'astronautA', kit: 'space' }] },
    },
  },
  wiese: {
    kit: 'nature',
    items: {
      flowerRed: F('flower_redA'), flowerYellow: F('flower_yellowA'), flowerPurple: F('flower_purpleA'),
      flowerRed2: F('flower_redC'), flowerYellow2: F('flower_yellowC'), flowerPurple2: F('flower_purpleB'),
      bush: F('plant_bush'), bushLarge: F('plant_bushLarge'), bushDetailed: F('plant_bushDetailed'),
      treeOak: F('tree_oak'), treeDefault: F('tree_default'), treeDetailed: F('tree_detailed'), treeFat: F('tree_fat'),
      mushroom: F('mushroom_red'), mushroomGroup: F('mushroom_redGroup'), fence: F('fence_simple'), stump: F('stump_round'),
      log: F('log'), rock: F('rock_smallA'), grass: F('grass'), grassLarge: F('grass_large'), lily: F('lily_large'),
      pathStone: F('path_stone'), tent: F('tent_detailedOpen'),
      apple: { parts: [{ src: 'apple', kit: 'food' , scale: 0.3 }] }, sandwich: { parts: [{ src: 'sandwich', kit: 'food' , scale: 0.3 }] },
      cupcake: { parts: [{ src: 'cupcake', kit: 'food' , scale: 0.3 }] }, strawberry: { parts: [{ src: 'strawberry', kit: 'food' , scale: 0.3 }] },
      cherries: { parts: [{ src: 'cherries', kit: 'food' , scale: 0.3 }] }, carrot: { parts: [{ src: 'carrot', kit: 'food' , scale: 0.3 }] },
      cake: { parts: [{ src: 'cake', kit: 'food' , scale: 0.3 }] },
    },
  },
  mond: {
    kit: 'space',
    recolor: GREY,
    items: {
      rover: F('rover'), dish: F('satelliteDish_large'), dishSmall: F('satelliteDish'), hangarGlass: F('hangar_roundGlass'),
      hangar: F('hangar_smallA'), hangarRound: F('hangar_roundA'), crater: F('crater'), craterLarge: F('craterLarge'),
      rockLarge: F('rock_largeA'), rockLarge2: F('rock_largeB'), rocks: F('rocks_smallA'), rocks2: F('rocks_smallB'),
      meteor: F('meteor_detailed'), crystals: F('rock_crystals'), crystalsLarge: F('rock_crystalsLargeA'),
      machine: F('machine_wireless'), generator: F('machine_generator'), structure: F('structure'),
      speeder: F('craft_speederA'), cargo: F('craft_cargoA'), gate: F('gate_complex'), pipeRing: F('pipe_ring'),
      rocket: { parts: [{ src: 'rocket_finsA' }, { src: 'rocket_fuelA', stack: true }, { src: 'rocket_sidesA', stack: true }, { src: 'rocket_topA', stack: true }] },
      platform: F('platform_large'), barrels: F('barrels'), astronaut: F('astronautB'),
    },
  },
};
