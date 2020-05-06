const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');
const babelTraverse = require('@babel/traverse').default;

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
    sourceType: 'module'
  });

  babelTraverse(ast, {
    ImportDeclaration: function(path) {
      dependencies.push(path.node.source.value);
    }
  });

  return {
    id,
    filename,
    dependencies,
    depIdMapping: {}
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

  deps.forEach(depRelativePath => {
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
  // TODO: bundle and output
}

bundle();
