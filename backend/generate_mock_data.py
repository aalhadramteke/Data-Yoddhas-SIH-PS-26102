import os
import random
from datetime import datetime, timedelta
import psycopg2
from psycopg2 import extras

# DB Connection configuration
DB_CONFIG = {
    "host": "localhost",
    "database": "mplad_db",
    "user": "mplad_admin",
    "password": "mplad_password",
    "port": "5433"
}

def generate_mock_data():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("Connected to DB. Generating mock data...")

        # 1. Generate 500 Projects
        categories = ['Roads', 'Water', 'Education', 'Health', 'Community Center']
        sc_st_categories = ['SC', 'ST', 'General']
        mp_ids = [f"MP_{i:03d}" for i in range(1, 21)]
        
        projects_data = []
        for i in range(500):
            # Randomize amount: most between 50k and 5L, some outliers for ML
            if i % 50 == 0:
                amount = random.uniform(1000000, 5000000) # Spike
            else:
                amount = random.uniform(50000, 500000)

            # Date logic: mostly compliant, some SLA breaches
            days_offset = random.randint(-60, 60)
            deadline = datetime.now() + timedelta(days=days_offset)
            
            projects_data.append((
                random.choice(mp_ids),
                f"Project {i+1}: {random.choice(categories)} Work",
                amount,
                random.choice(categories),
                deadline.date(),
                random.choice(sc_st_categories)
            ))

        insert_project_query = """
            INSERT INTO projects (mp_id, project_name, sanction_amount, category, sla_deadline, sc_st_category)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING project_id;
        """
        
        project_ids = []
        for p in projects_data:
            cur.execute(insert_project_query, p)
            project_ids.append(cur.fetchone()[0])

        # 2. Generate Assets with Spatial Anomalies
        # Reference center for "fraud clusters" (example: Delhi coords)
        center_lat, center_lon = 28.6139, 77.2090
        
        assets_data = []
        for pid in project_ids:
            # Default: random point within a city
            lat = center_lat + random.uniform(-0.1, 0.1)
            lon = center_lon + random.uniform(-0.1, 0.1)
            
            # Inject spatial overlap anomaly: 10% of projects share the exact same spot
            if random.random() < 0.1:
                lat, lon = 28.6139, 77.2090 
            
            # Perceptual hash mock (simulating imagehash.phash)
            # Use a repeated hash for some to simulate photo reuse
            p_hash = f"hash_{random.randint(1000, 9999)}"
            if random.random() < 0.05:
                p_hash = "static_fraud_hash_123"

            assets_data.append((pid, f'POINT({lon} {lat})', f'http://storage.local/img_{pid}.jpg', p_hash))

        insert_asset_query = """
            INSERT INTO assets (project_id, location, photo_url, perceptual_hash)
            VALUES (%s, ST_GeomFromText(%s, 4326), %s, %s);
        """
        extras.execute_batch(cur, insert_asset_query, assets_data)

        conn.commit()
        print(f"Successfully seeded 500 projects and their assets.")
        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error seeding data: {e}")

if __name__ == "__main__":
    generate_mock_data()
