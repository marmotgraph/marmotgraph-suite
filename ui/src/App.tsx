import React from "react";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Layout from "./views/Layout";

import QueryHome from "./modules/query-builder/QueryHome";
import Test from "./modules/query-builder/Test";
import EditorHome from "./modules/editor/EditorHome";
import VisualizerHome from "./modules/visualizer/VisualizerHome";

function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route index element={<h3 className="text-center">Welcome!</h3>} />
          <Route path="queries/*" element={<QueryHome />} />
          <Route path="queries/test/*" element={<Test />} />
          <Route path="editor/*" element={<EditorHome />} />
          <Route path="visualizer/*" element={<VisualizerHome />} />
          <Route path="*" element={<h4>Page not found</h4>} />
        </Routes>
      </Layout>
    </>
  );
}

export default App;
