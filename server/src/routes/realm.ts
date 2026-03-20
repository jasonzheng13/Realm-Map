import {Router, Response} from 'express';
import crypto from 'crypto';
import pool from '../config/database';
import authMiddleware, {AuthRequest} from '../middleware/auth';

const router = Router();

// POST /api/realms
router.post('/', authMiddleware, async(req: AuthRequest, res: Response) => {
    const{name} = req.body;
    const userID = req.user!.id;

    if(!name){
        return res.status(400).json({error: 'Realm name is not supported'});
    }

    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const client = await pool.connect();

    try{
        await client.query('BEGIN');
        
        const realmResult = await client.query(
            `INSERT INTO realms(name, owner_id, invite_code)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [name, userID, inviteCode]
        );
        
        const realm = realmResult.rows[0];

        await client.query(
            `INSERT INTO realm_members(realm_id, user_id, role)
            VALUES($1, $2, 'owner')`,
            [realm.id, userID]
        );

        await client.query('COMMIT');
        res.status(201).json(realm);
    } catch(err){
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({error: 'server error'});
    } finally{
        client.release();
    }
});

//POST /api/realms/join checks for duplicates, same member joining more than once
router.post('/join', authMiddleware, async(req: AuthRequest, res: Response) => {
    const{invite_code} = req.body;
    const userID = req.user!.id;

    if(!invite_code){
        return res.status(400).json({error: 'Invite code is required'});
    }
    
    try{
        const realmResult = await pool.query(
            'SELECT * FROM realms WHERE invite_code = $1',
            [invite_code]
        );

        if(realmResult.rows.length === 0){
            return res.status(404).json({error: 'Invalid invite code'});
        }

        const realm = realmResult.rows[0];

        const existing = await pool.query(
            'SELECT * FROM realm_members WHERE realm_id = $1 AND user_id = $2',
            [realm.id, userID]
        );

        if(existing.rows.length > 0){
            return res.status(400).json({error: 'You are already a member of this realm'});
        }
        await pool.query(
            `INSERT INTO realm_members(realm_id, user_id, role)
            VALUES($1, $2, 'member')`,
            [realm.id, userID]
            );

            res.status(201).json({message: 'Joined realm successfully'});
        } catch(err){
            console.error(err);
            res.status(500).json({error: 'Server error'});
        }
});

//GET /api/realms gets all realms for the logged-in user
router.get('/', authMiddleware, async(req: AuthRequest, res: Response) => {
    const userID = req.user!.id;

    try{
        const result = await pool.query(
            `SELECT realms.* FROM realms
            JOIN realm_members ON realms.id = realm_members.realm_id
            WHERE realm_members.user_id = $1`,
            [userID]
        );

        res.json(result.rows);     
    } catch(err){
        console.error(err);
        res.status(500).json({error: 'Server error'});
    }
});

export default router;
