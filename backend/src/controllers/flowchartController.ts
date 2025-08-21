import { Request, Response } from "express";
import { pool } from "../db/db";
import { v4 as uuidv4 } from "uuid";

// สร้าง Flowchart พร้อม nodes และ edges
export const createFlowchart = async (req: Request, res: Response) => {
  const { name, description, nodes, edges } = req.body;
  const flowchartID = uuidv4(); // สร้าง UUID

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO flowcharts (id, name, description) VALUES ($1, $2, $3)`,
      [flowchartID, name, description]
    );

    for (const node of nodes) {
      await client.query(
        `INSERT INTO nodes (id, flowchart_id, type, label, position_x, position_y)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [node.id, flowchartID, node.type, node.label, node.x, node.y]
      );
    }

    for (const edge of edges) {
      await client.query(
        `INSERT INTO edges (id, flowchart_id, from_node_id, to_node_id, label)
         VALUES ($1, $2, $3, $4, $5)`,
        [edge.id, flowchartID, edge.from, edge.to, edge.label]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ message: "Flowchart created successfully", flowchartID });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

// อ่าน Flowchart
export const getFlowchart = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const flowchartRes = await pool.query(`SELECT * FROM flowcharts WHERE id = $1`, [id]);
    const nodesRes = await pool.query(`SELECT * FROM nodes WHERE flowchart_id = $1`, [id]);
    const edgesRes = await pool.query(`SELECT * FROM edges WHERE flowchart_id = $1`, [id]);

    if (flowchartRes.rowCount === 0) {
      return res.status(404).json({ error: "Flowchart not found" });
    }

    res.json({
      flowchartID: id,
      name: flowchartRes.rows[0].name,
      description: flowchartRes.rows[0].description,
      nodes: nodesRes.rows.map((n) => ({
        id: n.id,
        flowchartid: n.flowchart_id,
        type: n.type,
        label: n.label,
        x: n.position_x,
        y: n.position_y,
      })),
      edges: edgesRes.rows.map((e) => ({
        id: e.id,
        flowchartid: e.flowchart_id,
        from: e.from_node_id,
        to: e.to_node_id,
        label: e.label,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// ลบ Flowchart (ลบ nodes & edges ด้วยเพราะ ON DELETE CASCADE)
export const deleteFlowchart = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM flowcharts WHERE id = $1`, [id]);
    res.json({ message: "Flowchart deleted" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};



