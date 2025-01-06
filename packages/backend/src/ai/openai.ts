import OpenAI from "openai";

const openai = new OpenAI({
    // apiKey: process.env.OPENAI_API_KEY,
    apiKey: "",
    dangerouslyAllowBrowser: true
});


const callOpenAI = async (prompt: string): Promise<string> => {
    
    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            {
                role: "user",
                content: prompt,
            },
        ],
    });
    
    console.log(completion.choices[0].message);

    return completion.choices[0].message.content ?? '';
};

export default callOpenAI;
