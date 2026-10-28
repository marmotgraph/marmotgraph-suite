import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";
import Layout from "./views/Layout";
import { InstancesProvider } from "./contexts/InstancesContext";
import { UnsavedInstancesProvider } from "./contexts/UnsavedInstancesContext";

import { QueryHome } from "./modules/query-builder/QueryHome";
import { QueryDetail } from "./modules/query-builder/QueryDetail";
import EditorHome from "./modules/editor/EditorHome";
import InstanceDetail from "./modules/editor/InstanceDetail";
import VisualizerHome from "./modules/visualizer/VisualizerHome";
import ModelerHome from "./modules/modeler/ModelerHome";
import ApiHome from "./modules/api/ApiHome";
import AdminHome from "./modules/admin/AdminHome";

function App() {
  return (
    <InstancesProvider>
      <UnsavedInstancesProvider>
        <Layout>
        <Routes>
          {/* TODO: replace with a proper welcome page; until then open the first module */}
          <Route index element={<Navigate to="/editor" replace />} />
          <Route path="queries" element={<QueryHome />} />
          <Route path="queries/shared" element={<Navigate to="/queries" replace />} />
          <Route path="queries/:queryId" element={<QueryDetail />} />
          <Route path="editor" element={<EditorHome />} />
          <Route path="editor/instances/:instanceId" element={<InstanceDetail />} />
          <Route path="visualizer/*" element={<VisualizerHome />} />
          <Route path="modeler/*" element={<ModelerHome />} />
          <Route path="core-api" element={<ApiHome />} />
          <Route path="admin/*" element={<AdminHome />} />
          <Route path="*" element={<h4>Page not found</h4>} />
        </Routes>
      </Layout>
      </UnsavedInstancesProvider>
    </InstancesProvider>
  );
}

export default App;
