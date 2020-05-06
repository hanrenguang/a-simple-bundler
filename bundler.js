const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');
const babelTraverse = require('@babel/traverse').default;
const babelTransformFromAstSync = require('@babel/core').transformFromAstSync;

let ID = 0;

/**
 * parse the asset
 * @param {String} filename
 */
function createAssets(filename) {
  const id = ID++;
  const dependencies = [];
  const content = fs.readFileSync(filename, 'utf-8');
  const ast = babelParser.parse(content, {
    sourceType: 'module',
  });

  const { code } = babelTransformFromAstSync(ast, content, {
    presets: ['@babel/preset-env'],
  });

  babelTraverse(ast, {
    ImportDeclaration(nodePath) {
      dependencies.push(nodePath.node.source.value);
    },
  });

  return {
    id,
    filename,
    code,
    dependencies,
    depIdMapping: {},
  };
}

/**
 * traverse dependencies to get all the modules
 * @param {Array} modules
 * @param {String} reason
 * @param {String} deps
 * @param {Object} depIdMapping
 */
function addDependencies(graph, reason, deps, depIdMapping) {
  const depDirPath = path.dirname(reason);

  deps.forEach((depRelativePath) => {
    const depPath = path.join(depDirPath, depRelativePath);
    const module = createAssets(depPath);

    graph.push(module);
    depIdMapping[depRelativePath] = module.id;

    addDependencies(graph, depPath, module.dependencies, module.depIdMapping);
  });
}

/**
 * create dependency graph from the entryPoint
 * @param {String} entry
 */
function createGraph(entry) {
  const graph = [];
  const entryPoint = createAssets(entry);

  graph.push(entryPoint);
  addDependencies(graph, entry, entryPoint.dependencies, entryPoint.depIdMapping);

  return graph;
}

/**
 * start bundling
 */
function bundle() {
  const configs = JSON.parse(fs.readFileSync('bundle.config.json'));
  const graph = createGraph(configs.entry);
  let modules = '';

  graph.forEach((mod) => {
    const { id, code, depIdMapping } = mod;
    modules += `${id}: [
      function (require, module, exports) {
        ${code}
      },
      ${JSON.stringify(depIdMapping)},
    ],`;
  });

  const result = `
(function (modules) {
  function require(id) {
    var fn = modules[id][0];
    var mapping = modules[id][1];

    function localRequire(relativePath) {
      return require(mapping[relativePath]);
    }

    var module = {
      exports: {}
    };
    fn(localRequire, module, module.exports);

    return module.exports;
  }

  require(0);
})({
  ${modules}
});
  `;

  if (!fs.existsSync('dist')) fs.mkdirSync('dist');
  fs.writeFile('dist/bundle.js', result, 'utf8', (err) => {
    if (err) throw err;
  });
}

bundle();
