using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Mirror;

public class AreaSkillEffect : SkillEffect
{
	public float timeToDestroy;
	public List<Entity> candidates = new List<Entity>();

	public int damageAmount;
	public float damageMultiplier;
	public float stunChance; // range [0,1]
	public float stunTime; // in seconds

	private bool isCasting = false;

	public void OnTriggerEnter(Collider other)
	{
		Entity victim = other.GetComponentInParent<Entity>();
		if (victim != null && !((Player)caster).Tools_SameRealm(victim))
		{
			if (victim != caster)
			{
				if (!candidates.Contains(victim))
				{
					candidates.Add(victim);
					if (!isCasting)
					{
						isCasting = true;
						StartCoroutine(Attack());
					}
				}
			}
		}
	}

	public void OnTriggerStay(Collider other)
	{
		Entity victim = other.GetComponentInParent<Entity>();
		if (victim != null && !((Player)caster).Tools_SameRealm(victim))
		{
			if (victim != caster)
			{
				if (!candidates.Contains(victim))
				{
					candidates.Add(victim);
				}
			}
		}
	}

	IEnumerator Attack()
	{
		for (int i = 0; i < 10; i++)
		{
			foreach (Entity candidate in candidates)
			{
				caster.combat.DealDamageAt(candidate, damageAmount, stunChance, stunTime);
			}
			Debug.Log($"attack {i + 1}: " + Time.time);
			yield return new WaitForSeconds(1f); // Wait for 1 second before the next damage step
		}
		isCasting = false; // Reset casting flag after all damage is dealt
	}

	void FixedUpdate()
	{
		if (isServer)
		{
			timeToDestroy -= Time.deltaTime;

			if (timeToDestroy <= 0)
			{
				NetworkServer.Destroy(gameObject);
			}
		}
	}
}
