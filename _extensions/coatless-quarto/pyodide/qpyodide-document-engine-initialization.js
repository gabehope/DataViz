// Create a logging setup
globalThis.qpyodideMessageArray = []

// Add messages to array
globalThis.qpyodideAddToOutputArray = function(message, type) {
  qpyodideMessageArray.push({ message, type });
}

// Function to reset the output array
globalThis.qpyodideResetOutputArray = function() {
  qpyodideMessageArray = [];
}

globalThis.qpyodideRetrieveOutput = function() {
  return qpyodideMessageArray.map(entry => entry.message).join('\n');
}

// Start a timer
const initializePyodideTimerStart = performance.now();

const pythonsetup = `
from pyodide.ffi import to_js
import micropip
import pyodide_http
pyodide_http.patch_all()

import altair as alt
import numpy as np
import pandas as pd
import js

def convert(data):
  if isinstance(data, pd.DataFrame):
    data = dict(type='dataframe', data=data.to_dict(orient='records'))
  elif isinstance(data, alt.Chart):
    data = dict(type='altair', data=data.to_json())
  else:
    data = repr(data)
  return to_js(data, dict_converter=js.Object.fromEntries)

convert
`;

const workercode = `
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

async function loadPyodideAndPackages() {
  self.pyodide = await loadPyodide();
  await self.pyodide.loadPackage(["numpy", "pytz", "altair", "pandas"]);
  await self.pyodide.loadPackage("micropip");
  //await self.pyodide.runPythonAsync('import micropip');
  await self.pyodide.loadPackage("pyodide_http");
  self.convert = await self.pyodide.runPythonAsync(\`${pythonsetup}\`);
  //await self.pyodide.runPythonAsync('import pyodide_http;pyodide_http.patch_all();  # Patch all libraries');
}
let pyodideReadyPromise = loadPyodideAndPackages();

self.onmessage = async (event) => {
  // make sure loading is done
  await pyodideReadyPromise;
  // Don't bother yet with this line, suppose our API is built in such a way:
  const { id, python, ...context } = event.data;
  // The worker copies the context in its own "memory" (an object mapping name to values)
  for (const key of Object.keys(context)) {
    self[key] = context[key];
  }
    
  document.pyodideMplTarget = graphFigure;
  // Now is the easy part, the one that is similar to working in the main thread:
  try {
    await self.pyodide.loadPackagesFromImports(python);
    let results = self.convert(await self.pyodide.runPythonAsync(python));
    console.log({ results, id });
    self.postMessage({ results, id });
  } catch (error) {
    self.postMessage({ error: error.message, id });
  }
};
`;

const pyodideSetup = async() =>{

  console.log("Start loading Pyodide");
  
  // Populate Pyodide options with defaults or new values based on `pyodide`` meta
  let mainPyodide;
  
  // Setup a namespace for global scoping
  // await loadedPyodide.runPythonAsync("globalScope = {}"); 
  
  // Update status to reflect the next stage of the procedure
  qpyodideUpdateStatusHeaderSpinner("Initializing Python Packages");


  const blob = new Blob([
    workercode
  ], { type: "text/javascript" })

  if (globalThis.pyodideWorker) {
    console.log("Terminating existing Pyodide worker");
    globalThis.pyodideWorker.terminate();
  }

  const pyodideWorker = new Worker(window.URL.createObjectURL(blob));
  globalThis.pyodideWorker = pyodideWorker;
  const callbacks = {};
  pyodideWorker.onmessage = (event) => {
    const { id, ...data } = event.data;
    const onSuccess = callbacks[id];
    delete callbacks[id];
    onSuccess(data);
  };

  const asyncRun = (() => {
    let id = 0; // identify a Promise
    return (script, context) => {
      // the id could be generated more carefully
      id = (id + 1) % Number.MAX_SAFE_INTEGER;
      return new Promise((onSuccess) => {
        callbacks[id] = onSuccess;
        pyodideWorker.postMessage({
          ...context,
          python: script,
          id,
        });
      });
    };
  })();

  try {
    const { results, error } = await asyncRun('', {});
  } catch (e) {
    console.log(
      `Error in pyodideWorker at ${e.filename}, Line: ${e.lineno}, ${e.message}`,
    );
  }

  // Unlock interactive buttons
  qpyodideSetInteractiveButtonState(
    `<i class="fa-solid fa-play qpyodide-icon-run-code"></i>`, 
    true
  );

  // Set document status to viable
  qpyodideUpdateStatusHeader(
    "🟢 Ready!"
  );

  // Assign Pyodide into the global environment
  globalThis.mainPyodide = asyncRun;
  globalThis.cellContainer.autoRunExecuteAllCells();
  console.log("Completed loading Pyodide");
  return asyncRun;
};

// Encase with a dynamic import statement
globalThis.qpyodideInstance = await pyodideSetup();
// Stop timer
const initializePyodideTimerEnd = performance.now();

// Create a function to retrieve the promise object.
globalThis._qpyodideGetInstance = function() {
    return qpyodideInstance;
}
