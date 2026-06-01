import React from "react";
import { Route, Routes } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import Layout from "./views/Layout";
import { InstancesProvider } from "./contexts/InstancesContext";
import { UnsavedInstancesProvider } from "./contexts/UnsavedInstancesContext";

import { QueryHome } from "./modules/query-builder/QueryHome";
import { QueryDetail } from "./modules/query-builder/QueryDetail";
import Test from "./modules/query-builder/Test";
import EditorHome from "./modules/editor/EditorHome";
import InstanceDetail from "./modules/editor/InstanceDetail";
import VisualizerHome from "./modules/visualizer/VisualizerHome";
import { SharedQueries } from "./modules/query-builder/SharedQueries";

function App() {
  return (
    <InstancesProvider>
      <UnsavedInstancesProvider>
        <Layout>
        <Routes>
          <Route index element={<h3 className="text-center">Welcome!</h3>} />
          <Route path="queries" element={<QueryHome />} />
          <Route path="queries/shared" element={<SharedQueries />} />
          <Route path="queries/:queryId" element={<QueryDetail />} />
          <Route path="queries/test/*" element={<Test />} />
          <Route path="editor" element={<EditorHome />} />
          <Route path="editor/instance/:instanceId" element={<InstanceDetail />} />
          <Route path="instances/:instanceId" element={<InstanceDetail />} />
          <Route path="visualizer/*" element={<VisualizerHome />} />
          <Route path="*" element={<h4>Page not found</h4>} />
        </Routes>
      </Layout>
      </UnsavedInstancesProvider>
    </InstancesProvider>
  );
}

export default App;
