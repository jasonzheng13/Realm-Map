import { Router, Response } from 'express';
import pool from '../config/database';
import authenticateToken, { AuthRequest } from '../middleware/auth';
import { Server } from 'socket.io';

const createWaypointsRouter = (io: Server) => {
  const router = Router();

  // GET /api/waypoints?realm_id=...&dimension=...
  router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { realm_id, dimension } = req.query;

    if (!realm_id) {
      return res.status(400).json({ error: 'realm_id is required' });
    }

    try {
      let query = 'SELECT * FROM waypoints WHERE realm_id = $1';
      const params: any[] = [realm_id];

      if (dimension) {
        query += ' AND dimension = $2'; // Bug fix: space before AND
        params.push(dimension);
      }

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/waypoints
  router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { realm_id, name, x, y, z, dimension, description } = req.body;
    const userId = req.user!.id;

    if (!realm_id || !name || x == undefined || y == undefined || z == undefined || !dimension) {
      return res.status(400).json({ error: 'Missing required fields' }); // Bug fix: added .json()
    }

    try {
      const result = await pool.query(
        `INSERT INTO waypoints (realm_id, created_by, name, x, y, z, dimension, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [realm_id, userId, name, x, y, z, dimension, description || null]
      );

      const newWaypoint = result.rows[0];
      io.to(newWaypoint.realm_id).emit('waypoint:created', newWaypoint); // Broadcast
      res.status(201).json(newWaypoint);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PUT /api/waypoints/:id
  router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, x, y, z, dimension, description } = req.body;
    const userId = req.user!.id;

    try {
      const existing = await pool.query('SELECT * FROM waypoints WHERE id = $1', [id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Waypoint not found' });
      }
      if (existing.rows[0].created_by !== userId) {
        return res.status(403).json({ error: 'Not authorized to edit this waypoint' });
      }

      const result = await pool.query(
        `UPDATE waypoints
         SET name = $1, x = $2, y = $3, z = $4, dimension = $5, description = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [name, x, y, z, dimension, description || null, id]
      );

      const updated = result.rows[0];
      io.to(updated.realm_id).emit('waypoint:updated', updated); // Broadcast
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // DELETE /api/waypoints/:id
  router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    try {
      const existing = await pool.query('SELECT * FROM waypoints WHERE id = $1', [id]);

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Waypoint not found' });
      }
      if (existing.rows[0].created_by !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this waypoint' });
      }

      const realmId = existing.rows[0].realm_id; // Grab realm_id BEFORE deleting
      await pool.query('DELETE FROM waypoints WHERE id = $1', [id]);
      io.to(realmId).emit('waypoint:deleted', { id }); // Broadcast
      res.json({ message: 'Waypoint deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};

export default createWaypointsRouter;