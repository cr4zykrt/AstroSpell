// =====================================
// Word bank for the level generator
// =====================================
// Plain lowercase words only (a-z, no spaces or hyphens) so every letter can be
// spoken with the phonetic alphabet. The generator groups the words by their real
// length, so you can add or remove words freely. Keep at least ~5 words for every
// length from 4 to 16 letters (the unit tests will tell you if a length runs short).

export const WORDS = [
  // 4 letters
  'star', 'moon', 'mars', 'nova', 'halo', 'void', 'dust', 'ring', 'core', 'belt',
  'rift', 'warp', 'zone', 'lava', 'rays', 'flux', 'mass',

  // 5 letters
  'comet', 'orbit', 'lunar', 'solar', 'venus', 'pluto', 'probe', 'laser', 'flare',
  'earth', 'titan', 'space', 'alien', 'phase', 'radar', 'pulse', 'epoch', 'quark',

  // 6 letters
  'planet', 'rocket', 'nebula', 'meteor', 'saturn', 'quasar', 'galaxy', 'uranus',
  'saucer', 'photon', 'plasma', 'cosmos', 'vortex', 'lander', 'thrust', 'zenith',
  'apogee', 'binary', 'corona', 'crater', 'launch', 'module', 'sensor', 'vacuum',
  'zodiac',

  // 7 letters
  'eclipse', 'voyager', 'gravity', 'shuttle', 'mercury', 'neptune', 'jupiter',
  'station', 'capsule', 'stellar', 'orbital', 'mission', 'cluster', 'horizon',
  'equinox', 'booster', 'antenna', 'perigee',

  // 8 letters
  'asteroid', 'universe', 'starship', 'aphelion', 'crescent', 'sunlight', 'thruster',
  'magnetar', 'ecliptic', 'solstice', 'infinity', 'orbiting', 'galactic', 'meteoric',

  // 9 letters
  'astronaut', 'supernova', 'telescope', 'starlight', 'meteoroid', 'cosmonaut',
  'satellite', 'planetary', 'astronomy', 'moonlight', 'spaceship', 'exosphere',
  'terraform', 'planetoid', 'meteorite', 'cosmology', 'starfield',

  // 10 letters
  'astronomer', 'spacecraft', 'atmosphere', 'ionosphere', 'mesosphere', 'perihelion',
  'trajectory', 'rocketship', 'exoplanets', 'meteorites', 'satellites', 'telescopes',
  'cosmonauts', 'astronauts',

  // 11 letters
  'protoplanet', 'observatory', 'meteorology', 'heliosphere', 'troposphere',
  'gravitation', 'cosmologist', 'astronomers', 'astronautic', 'planetarium',
  'singularity', 'atmospheric',

  // 12 letters
  'thermosphere', 'stratosphere', 'interstellar', 'microgravity', 'astrophysics',
  'astronomical', 'cosmological', 'supermassive', 'exoplanetary', 'astrobiology',
  'cosmonautics', 'spectroscopy', 'spectrometer', 'astronautics', 'astrogeology',
  'planetesimal',

  // 13 letters
  'constellation', 'intergalactic', 'gravitational', 'magnetosphere', 'extragalactic',
  'circumstellar', 'thermonuclear', 'astrodynamics', 'planetesimals', 'observatories',
  'astronautical', 'hypervelocity', 'astrophysical',

  // 14 letters
  'interplanetary', 'weightlessness', 'radiotelescope', 'interferometer',
  'astronomically', 'cosmochemistry', 'thermodynamics', 'astrochemistry',
  'astrobiologist', 'astrophysicist', 'cosmologically', 'constellations',

  // 15 letters
  'electromagnetic', 'astrophysicists', 'gravitationally', 'nucleosynthesis',
  'astrobiologists',

  // 16 letters
  'extraterrestrial', 'astrophotography', 'electromagnetism', 'multidimensional',
  'exoplanetologist'
];
