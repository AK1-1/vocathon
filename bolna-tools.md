# Bolna Custom Tool Schemas — NestFlow

Paste each schema below into the Bolna agent's **Tools Tab** (one custom function at a time).

> **Before pasting:** replace every `https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app` with your live ngrok HTTPS URL.
> If you protect the endpoints with a shared secret, put it in `api_token` (sent as the `Authorization` header) and validate it server-side.

Format notes (Bolna-specific, not plain OpenAI JSON):
- `key` must be `"custom_task"`.
- `value.param` maps parameters with Python format specifiers: `%(x)s` string, `%(x)i` int, `%(x)f` float.
- Param names in `value.param` must match the keys in `parameters.properties` exactly.
- For **POST** tools the `param` map is sent as the JSON body; for **GET** it becomes the query string.
- `pre_call_message` is spoken aloud while the API call runs, masking network latency.

---

## 1. Add Grocery — `POST /api/groceries`

```json
{
  "name": "add_grocery",
  "description": "Call when the user wants to add a grocery or shopping item to the household shopping list. Capture the item name, and the quantity and category if mentioned.",
  "pre_call_message": "Got it, adding that to the grocery list.",
  "parameters": {
    "type": "object",
    "properties": {
      "item": {
        "type": "string",
        "description": "Name of the grocery item, e.g. 'Milk', 'Tomatoes', 'Atta'"
      },
      "quantity": {
        "type": "string",
        "description": "Amount to buy, including units if given, e.g. '2 litres', '1 kg', '500 g'. Use 'unspecified' if not mentioned."
      },
      "category": {
        "type": "string",
        "description": "Grocery category, e.g. 'Dairy', 'Vegetables', 'Staples', 'Snacks'. Use 'General' if unclear."
      }
    },
    "required": ["item"]
  },
  "key": "custom_task",
  "value": {
    "method": "POST",
    "param": {
      "item": "%(item)s",
      "quantity": "%(quantity)s",
      "category": "%(category)s"
    },
    "url": "https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app/api/groceries",
    "api_token": "",
    "headers": {}
  }
}
```

---

## 2. Assign Chore — `POST /api/chores`

```json
{
  "name": "assign_chore",
  "description": "Call when the user wants to create or assign a household chore or task to a family member. Capture the task title, who it is assigned to, its priority, and any notes.",
  "pre_call_message": "Sure, I'll add that chore.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Short description of the chore, e.g. 'Clean kitchen counters', 'Take out the trash'"
      },
      "assignee": {
        "type": "string",
        "description": "Name of the family member responsible for the chore. Use 'Unassigned' if not specified."
      },
      "priority": {
        "type": "string",
        "enum": ["low", "medium", "high"],
        "description": "Urgency of the chore. Default to 'medium' if not stated."
      },
      "notes": {
        "type": "string",
        "description": "Any extra detail or timing, e.g. 'after dinner'. Use empty string if none."
      }
    },
    "required": ["title"]
  },
  "key": "custom_task",
  "value": {
    "method": "POST",
    "param": {
      "title": "%(title)s",
      "assignee": "%(assignee)s",
      "priority": "%(priority)s",
      "notes": "%(notes)s"
    },
    "url": "https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app/api/chores",
    "api_token": "",
    "headers": {}
  }
}
```

---

## 3. Log Help Instruction — `POST /api/instructions`

```json
{
  "name": "log_instruction",
  "description": "Call when the user wants to leave an instruction for domestic help such as a cook, maid, driver, or gardener. Capture the instruction, who it is for, and the priority.",
  "pre_call_message": "Okay, noting that instruction down.",
  "parameters": {
    "type": "object",
    "properties": {
      "instruction": {
        "type": "string",
        "description": "The full instruction, e.g. 'Cook paneer butter masala for dinner', 'Mop the living room'"
      },
      "recipient": {
        "type": "string",
        "description": "Who the instruction is for, e.g. 'Cook', 'Maid', 'Driver', 'Gardener'. Use 'Help' if unclear."
      },
      "priority": {
        "type": "string",
        "enum": ["low", "medium", "high"],
        "description": "Urgency of the instruction. Default to 'medium' if not stated."
      }
    },
    "required": ["instruction"]
  },
  "key": "custom_task",
  "value": {
    "method": "POST",
    "param": {
      "instruction": "%(instruction)s",
      "recipient": "%(recipient)s",
      "priority": "%(priority)s"
    },
    "url": "https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app/api/instructions",
    "api_token": "",
    "headers": {}
  }
}
```

---

## 4. Get Summary — `GET /api/summary`

Used when the caller asks what is pending, e.g. "What do we need to buy?" or "What chores are left?". Takes no parameters; the backend returns the current pending groceries, chores, and instructions for the LLM to read back.

```json
{
  "name": "get_summary",
  "description": "Call when the user asks what is currently on any list, e.g. what needs to be bought, which chores are pending, or what instructions were left for the help. Returns the current pending groceries, chores, and instructions.",
  "pre_call_message": "Let me check the current lists.",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "key": "custom_task",
  "value": {
    "method": "GET",
    "param": {},
    "url": "https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app/api/summary",
    "api_token": "",
    "headers": {}
  }
}
```

---

## 5. Add Reminder — `POST /api/reminders`

Used when the caller wants something remembered so it isn't missed — medication, a birthday, an event, a festival, or travel prep.

```json
{
  "name": "add_reminder",
  "description": "Call when the user wants to be reminded of something so it is not missed — a medication, a birthday, an event, a festival, or travel prep. Capture what to remember, when it is due, the type, and any notes.",
  "pre_call_message": "Sure, I'll add that reminder.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "What to remember, e.g. 'Dad's blood pressure medicine', 'Ravi's birthday', 'Diwali shopping'"
      },
      "date": {
        "type": "string",
        "description": "When it is due or how often it recurs, e.g. '20 June', 'tomorrow 9 AM', 'every morning'. Use empty string if not given."
      },
      "type": {
        "type": "string",
        "enum": ["Medication", "Birthday", "Event", "Festival", "Travel", "Other"],
        "description": "Category of the reminder. Default to 'Event' if unclear."
      },
      "notes": {
        "type": "string",
        "description": "Any extra detail, e.g. 'buy gift beforehand', 'after breakfast'. Use empty string if none."
      }
    },
    "required": ["title"]
  },
  "key": "custom_task",
  "value": {
    "method": "POST",
    "param": {
      "title": "%(title)s",
      "date": "%(date)s",
      "type": "%(type)s",
      "notes": "%(notes)s"
    },
    "url": "https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app/api/reminders",
    "api_token": "",
    "headers": {}
  }
}
```
