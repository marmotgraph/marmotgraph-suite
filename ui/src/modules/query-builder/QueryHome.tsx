// import { observer } from "mobx-react-lite";
// import React from "react";

// const QueryHome = observer(() => {
//   return (
//     <>
//       <h2>Query home</h2>
//     </>
//   );
// });
// QueryHome.displayName = "Query Home";

// export default QueryHome;

import React, { useEffect, useState } from "react";
import { Button, Card, Col, Container, ListGroup, Row, Spinner } from "react-bootstrap";

/**
 * Shape of a single query item.
 * Adjust fields to match whatever your backend returns.
 */
interface QueryItem {
  id: string;
  name: string;
  description?: string;
}

/**
 * Mock data – replace with a real fetch call later.
 */
const MOCK_QUERIES: QueryItem[] = [
  {
    id: "q1",
    name: "Top 10 most active users",
    description: "Shows the ten users with the highest activity score.",
  },
  {
    id: "q2",
    name: "Daily sales summary",
    description: "Aggregates sales per day for the last month.",
  },
  {
    id: "q3",
    name: "GPU utilisation trends",
    description: "Time‑series of GPU utilisation across the cluster.",
  },
];

export default function QueryHome() {
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /** --------------------------------------------------------------
   *  Load queries – replace this with your real API call.
   *  ------------------------------------------------------------*/
  useEffect(() => {
    // Simulate async fetch
    const timer = setTimeout(() => {
      try {
        // TODO: replace with fetch('/api/queries') or similar
        setQueries(MOCK_QUERIES);
        setLoading(false);
      } catch (e) {
        setError("Failed to load queries.");
        setLoading(false);
      }
    }, 800); // fake latency

    return () => clearTimeout(timer);
  }, []);

  /** --------------------------------------------------------------
   *  Render helpers
   *  ------------------------------------------------------------*/
  const renderList = () => {
    if (queries.length === 0) {
      return (
        <Card.Body className="text-center py-5">
          <p className="mb-3">You don’t have any saved queries yet.</p>
          <Button variant="primary" size="sm">
            Create your first query
          </Button>
        </Card.Body>
      );
    }

    return (
      <ListGroup variant="flush">
        {queries.map((q) => (
          <ListGroup.Item
            key={q.id}
            action
            href={`#/queries/${q.id}`} // adjust routing as needed
            className="d-flex justify-content-between align-items-start"
          >
            <div className="ms-2 me-auto">
              <div className="fw-bold">{q.name}</div>
              {q.description && (
                <small className="text-muted">{q.description}</small>
              )}
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    );
  };

  /** --------------------------------------------------------------
   *  Main JSX
   *  ------------------------------------------------------------*/
  return (
    <Container fluid className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8}>
          {/* ----- Page Header ----- */}
          <h2 className="mb-4 text-center">My Queries</h2>

          {/* ----- Card wrapper ----- */}
          <Card>
            {loading && (
              <Card.Body className="text-center py-5">
                <Spinner animation="border" role="status" className="me-2" />
                Loading queries…
              </Card.Body>
            )}

            {error && (
              <Card.Body className="text-danger text-center py-5">
                {error}
              </Card.Body>
            )}

            {!loading && !error && renderList()}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
