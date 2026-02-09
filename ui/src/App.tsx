import React from "react";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Layout from "./views/Layout";

import QueryHome from "./modules/query-builder/QueryHome";

function App() {
  return (
    <>
      <div className="app-wrapper">
        <Layout>
          <Routes>
            <Route index element={<h3 className="text-center">Welcome!</h3>} />
            <Route path="queries/*" element={<QueryHome />} />
            <Route path="*" element={<h4>Page not found</h4>} />
          </Routes>
        </Layout>
      </div>
    </>
  );
}

export default App;
