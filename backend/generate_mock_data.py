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

        cur.execute("TRUNCATE TABLE anomaly_flags, assets, projects RESTART IDENTITY CASCADE")

        # 1. Generate 500 Projects
        categories = ['Roads', 'Water', 'Education', 'Health', 'Community Center']
        sc_st_categories = ['SC', 'ST', 'General']
        state_district_map = {
            'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
            'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
            'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru'],
            'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem'],
            'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra'],
            'West Bengal': ['Kolkata', 'Durgapur', 'Asansol', 'Howrah'],
            'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
            'Bihar': ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'],
        }
        district_coordinates = {
            'New Delhi': (28.6139, 77.2090),
            'North Delhi': (28.7128, 77.1994),
            'South Delhi': (28.5449, 77.1815),
            'East Delhi': (28.6667, 77.2763),
            'West Delhi': (28.6504, 77.1141),
            'Mumbai': (19.0760, 72.8777),
            'Pune': (18.5204, 73.8567),
            'Nagpur': (21.1458, 79.0882),
            'Nashik': (20.0110, 73.7905),
            'Bengaluru': (12.9716, 77.5946),
            'Mysuru': (12.2958, 76.6394),
            'Hubballi': (15.3647, 75.1240),
            'Mangaluru': (12.9141, 74.8560),
            'Chennai': (13.0827, 80.2707),
            'Coimbatore': (11.0168, 76.9558),
            'Madurai': (9.9252, 78.1198),
            'Salem': (11.6643, 78.1460),
            'Lucknow': (26.8467, 80.9462),
            'Kanpur': (26.4499, 80.3319),
            'Varanasi': (25.3176, 82.9739),
            'Agra': (27.1767, 78.0081),
            'Kolkata': (22.5726, 88.3639),
            'Durgapur': (23.5204, 87.3119),
            'Asansol': (23.6739, 86.9524),
            'Howrah': (22.5958, 88.2636),
            'Ahmedabad': (23.0225, 72.5714),
            'Surat': (21.1702, 72.8311),
            'Vadodara': (22.3072, 73.1812),
            'Rajkot': (22.3039, 70.8022),
            'Patna': (25.5941, 85.1376),
            'Gaya': (24.7955, 85.0002),
            'Muzaffarpur': (26.1226, 85.3906),
            'Bhagalpur': (25.2593, 86.9846),
        }
        state_options = list(state_district_map.keys())
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
            
            state_ut = random.choice(state_options)
            district = random.choice(state_district_map[state_ut])
            project_category = random.choice(categories)
            projects_data.append((
                random.choice(mp_ids),
                f"Project {i+1}: {project_category} Work",
                amount,
                project_category,
                state_ut,
                district,
                deadline.date(),
                random.choice(sc_st_categories)
            ))

        insert_project_query = """
            INSERT INTO projects (mp_id, project_name, sanction_amount, category, state_ut, district, sla_deadline, sc_st_category)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING project_id;
        """
        
        project_ids = []
        for p in projects_data:
            cur.execute(insert_project_query, p)
            project_ids.append(cur.fetchone()[0])

        # 2. Generate Assets with Spatial Anomalies
        cur.execute("SELECT project_id, state_ut, district FROM projects")
        project_rows = cur.fetchall()
        assets_data = []
        for pid, state_ut, district in project_rows:
            center_lat, center_lon = district_coordinates.get(district, (28.6139, 77.2090))
            for asset_index in range(3):
                lat = center_lat + random.uniform(-0.04, 0.04)
                lon = center_lon + random.uniform(-0.05, 0.05)

                if asset_index == 0 and random.random() < 0.1:
                    lat, lon = center_lat, center_lon

                p_hash = f"hash_{random.randint(1000, 9999)}"
                if random.random() < 0.05:
                    p_hash = "static_fraud_hash_123"

                assets_data.append((pid, f'POINT({lon} {lat})', f'http://storage.local/img_{pid}_{asset_index}.jpg', p_hash))

        insert_asset_query = """
            INSERT INTO assets (project_id, location, photo_url, perceptual_hash)
            VALUES (%s, ST_GeomFromText(%s, 4326), %s, %s);
        """
        extras.execute_batch(cur, insert_asset_query, assets_data)

        conn.commit()
        print(f"Successfully seeded 500 projects with {len(assets_data)} map assets.")
        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error seeding data: {e}")

if __name__ == "__main__":
    generate_mock_data()
